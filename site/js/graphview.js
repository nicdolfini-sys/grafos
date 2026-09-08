/* ============================================================
   GraphView — desenha UM grafo estático e recolore a busca sobre ele.

   Tudo é indexado por número (0..n-1) e guardado em typed arrays, para
   aguentar grafos grandes (o do 8-puzzle tem 181 440 nós) sem estourar
   memória nem travar a aba.

     setGraph({depths, edges}, onProgress, onDone)
        depths: Uint8Array/Int32Array de tamanho n (camada de cada nó)
        edges : Int32Array com pares de ÍNDICES achatados [a,b, a,b, ...]
     setExplored(indices, count)  -> região visitada pela busca
     setPath(indices)             -> caminho (sequência de índices)
     setCurrent(i) / setSuggested(i)   (-1 = nenhum)

   O grafo completo é rasterizado UMA vez (em lotes) para um canvas fora
   de tela; a cada quadro só desenhamos por cima o que muda.
   ============================================================ */
(function (global) {
  "use strict";

  var MAX_BASE_PX = 2400;
  var Y_GAP = 96;

  function GraphView(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.n = 0;
    this.depths = null;
    this.edges = null;          // Int32Array achatado de pares de índices
    this.xs = null;
    this.ys = null;

    this.flags = null;          // Uint8Array: 1 = explorado
    this.exploredList = null;
    this.exploredCount = 0;
    this._expEdges = null;      // Int32Array achatado
    this._expEdgeCount = 0;

    this.path = null;           // Array/Int32Array de índices, em sequência
    this.currentIdx = -1;
    this.suggestedIdx = -1;

    this.scale = 1; this.ox = 0; this.oy = 0;
    this.autoFit = true;
    this.worldW = 1; this.worldH = 1;

    this._raf = null;
    this._base = document.createElement("canvas");
    this._baseCtx = null;
    this._baseScale = 1;
    this._baseReady = false;
    this._rasterToken = 0;

    this._initInteraction();
    this._resize();

    var self = this;
    var resizeTimer = null;
    global.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        self._resize();
        if (!self.n) return;
        self._layout();
        if (self.autoFit) self.fit();
        self._rasterAll();
      }, 180);
    });
  }

  GraphView.prototype.count = function () {
    return { nodes: this.n, edges: this.edges ? this.edges.length >> 1 : 0 };
  };

  GraphView.prototype.clear = function () {
    this.n = 0;
    this.depths = this.edges = this.xs = this.ys = null;
    this.flags = null;
    this.exploredList = null; this.exploredCount = 0;
    this._expEdgeCount = 0;
    this.path = null;
    this.currentIdx = this.suggestedIdx = -1;
    this._baseReady = false;
    this._rasterToken++;
    this.requestDraw();
  };

  // ---------------- grafo estático ----------------

  GraphView.prototype.setGraph = function (packed, onProgress, onDone) {
    var self = this;
    this._resize();

    this.n = packed.depths.length;
    this.depths = packed.depths;
    this.edges = packed.edges;
    this.flags = new Uint8Array(this.n);
    this.exploredList = null;
    this.exploredCount = 0;
    this._expEdges = null;
    this._expEdgeCount = 0;
    this.path = null;
    this.currentIdx = -1;
    this.suggestedIdx = -1;
    this._baseReady = false;

    this._layout();
    this.fit();
    if (onProgress) onProgress(0.08);

    this._rasterAll(onProgress, onDone);
  };

  // posiciona os nós em camadas (ordenação por contagem, sem alocar listas)
  GraphView.prototype._layout = function () {
    var n = this.n, d = this.depths, i;
    if (!n) return;

    var maxD = 0;
    for (i = 0; i < n; i++) if (d[i] > maxD) maxD = d[i];
    var L = maxD + 1;

    var counts = new Int32Array(L);
    for (i = 0; i < n; i++) counts[d[i]]++;

    var start = new Int32Array(L + 1);
    for (i = 0; i < L; i++) start[i + 1] = start[i] + counts[i];

    var cursor = start.slice(0, L);
    var byLayer = new Int32Array(n);
    for (i = 0; i < n; i++) byLayer[cursor[d[i]]++] = i;

    var maxLayer = 1;
    for (i = 0; i < L; i++) if (counts[i] > maxLayer) maxLayer = counts[i];

    var widthCap = Math.max((this.viewW || 700) * 2.4, 2200);
    var xGap = Math.min(28, widthCap / maxLayer);
    this.worldW = Math.max(this.viewW || 700, Math.min(widthCap, maxLayer * xGap) + 40);
    this.worldH = Math.max(this.viewH || 500, L * Y_GAP + 40);

    this.xs = new Float32Array(n);
    this.ys = new Float32Array(n);
    for (var layer = 0; layer < L; layer++) {
      var c = counts[layer];
      if (!c) continue;
      var span = Math.min(this.worldW - 40, c * xGap);
      var sx = (this.worldW - span) / 2;
      var y = 34 + layer * Y_GAP;
      var base = start[layer];
      for (var k = 0; k < c; k++) {
        var idx = byLayer[base + k];
        this.xs[idx] = c <= 1 ? sx + span / 2 : sx + (k * span) / (c - 1);
        this.ys[idx] = y;
      }
    }
  };

  // rasteriza todas as arestas em lotes (nunca segura a thread)
  GraphView.prototype._rasterAll = function (onProgress, onDone) {
    var self = this;
    var token = ++this._rasterToken;

    var scale = Math.min(MAX_BASE_PX / this.worldW, MAX_BASE_PX / this.worldH, 1.5);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    this._baseScale = scale;

    var b = this._base;
    var w = Math.max(1, Math.round(this.worldW * scale));
    var h = Math.max(1, Math.round(this.worldH * scale));
    var g;
    try {
      b.width = w; b.height = h;
      g = b.getContext("2d");
      if (!g) throw new Error("sem contexto 2d");
    } catch (err) {
      // sem canvas para a base: seguimos só com o overlay vetorial
      this._baseReady = false;
      if (onProgress) onProgress(1);
      if (onDone) onDone();
      this.requestDraw();
      return;
    }
    g.setTransform(scale, 0, 0, scale, 0, 0);
    g.clearRect(0, 0, this.worldW, this.worldH);
    g.strokeStyle = "rgba(231, 170, 220, 0.30)";
    g.lineWidth = 1 / scale;

    var E = this.edges, xs = this.xs, ys = this.ys;
    var m = E ? E.length >> 1 : 0;
    var e = 0;

    function chunk() {
      if (token !== self._rasterToken) return;
      var end = Math.min(m, e + 12000);
      g.beginPath();
      for (var i = e; i < end; i++) {
        var a = E[i * 2], c = E[i * 2 + 1];
        g.moveTo(xs[a], ys[a]);
        g.lineTo(xs[c], ys[c]);
      }
      g.stroke();
      e = end;
      if (onProgress) onProgress(0.08 + 0.92 * (m ? e / m : 1));
      if (e < m) {
        setTimeout(chunk, 0);
      } else {
        // pontinhos só quando o grafo é pequeno (senão vira mancha mesmo)
        if (self.n <= 24000) {
          g.fillStyle = "rgba(214, 150, 205, 0.55)";
          var hh = 2 / scale;
          for (var k = 0; k < self.n; k++) {
            g.fillRect(xs[k] - hh, ys[k] - hh, hh * 2, hh * 2);
          }
        }
        self._baseReady = true;
        self.requestDraw();
        if (onDone) onDone();
      }
    }
    chunk();
  };

  // ---------------- estado da busca (recolorido) ----------------

  GraphView.prototype.setExplored = function (list, count) {
    if (!this.n) return;
    var f = this.flags;
    f.fill(0);
    this.exploredList = list || null;
    this.exploredCount = count === undefined ? (list ? list.length : 0) : count;
    var i;
    for (i = 0; i < this.exploredCount; i++) f[list[i]] = 1;

    var E = this.edges, m = E ? E.length >> 1 : 0;
    if (!this._expEdges || this._expEdges.length < E.length) {
      this._expEdges = new Int32Array(E.length);
    }
    var buf = this._expEdges, k = 0;
    for (i = 0; i < m; i++) {
      var a = E[i * 2], b = E[i * 2 + 1];
      if (f[a] && f[b]) { buf[k++] = a; buf[k++] = b; }
    }
    this._expEdgeCount = k >> 1;
    this.requestDraw();
  };

  GraphView.prototype.setPath = function (idxList) {
    this.path = (idxList && idxList.length) ? idxList : null;
    this.requestDraw();
  };
  GraphView.prototype.setCurrent = function (i) {
    this.currentIdx = (i === undefined || i === null) ? -1 : i;
    this.requestDraw();
  };
  GraphView.prototype.setSuggested = function (i) {
    this.suggestedIdx = (i === undefined || i === null) ? -1 : i;
    this.requestDraw();
  };

  // ---------------- viewport ----------------

  GraphView.prototype._resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = global.devicePixelRatio || 1;
    var w = r.width || this.canvas.clientWidth || 0;
    var h = r.height || this.canvas.clientHeight || 0;
    if (w > 0 && h > 0) {
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      this.viewW = w;
      this.viewH = h;
    }
    this.dpr = dpr;
  };

  GraphView.prototype.fit = function () {
    if (!(this.viewW > 1) || !(this.viewH > 1)) this._resize();
    var s = Math.min(this.viewW / this.worldW, this.viewH / this.worldH) * 0.92;
    this.scale = (s > 0 && isFinite(s)) ? s : 1;
    this.ox = (this.viewW - this.worldW * this.scale) / 2;
    this.oy = (this.viewH - this.worldH * this.scale) / 2;
    this.autoFit = true;
    this.requestDraw();
  };

  GraphView.prototype.requestDraw = function () {
    if (this._raf) return;
    var self = this;
    this._raf = global.requestAnimationFrame(function () {
      self._raf = null;
      self._draw();
    });
  };

  // ---------------- desenho ----------------

  GraphView.prototype._draw = function () {
    var ctx = this.ctx;
    if (!this.n) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.viewW || 1, this.viewH || 1);
      return;
    }
    if (!(this.viewW > 1) || !(this.viewH > 1) ||
        !(this.scale > 0) || !isFinite(this.scale)) {
      this._resize();
      if (!(this.viewW > 1)) return;   // ainda escondido: tenta de novo depois
      this._layout();
      this.fit();
      this._rasterAll();
      return;
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // tamanhos em px de tela, limitados (nunca explodem com zoom pequeno)
    var sc = this.scale;
    function px(worldUnits, lo, hi) {
      var v = worldUnits / sc;
      return v < lo ? lo : (v > hi ? hi : v);
    }

    if (this._baseReady) {
      ctx.drawImage(this._base, 0, 0, this._base.width, this._base.height,
        this.ox, this.oy, this.worldW * sc, this.worldH * sc);
    }

    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(sc, sc);

    var xs = this.xs, ys = this.ys, i, a, b;

    // arestas exploradas
    if (this._expEdgeCount) {
      var eb = this._expEdges;
      ctx.strokeStyle = "rgba(197, 63, 182, 0.30)";
      ctx.lineWidth = px(1.1, 0.5, 4);
      ctx.beginPath();
      for (i = 0; i < this._expEdgeCount; i++) {
        a = eb[i * 2]; b = eb[i * 2 + 1];
        ctx.moveTo(xs[a], ys[a]); ctx.lineTo(xs[b], ys[b]);
      }
      ctx.stroke();
    }

    // nós explorados
    if (this.exploredCount && this.exploredCount <= 80000) {
      var hs = px(2.4, 1, 6);
      var list = this.exploredList;
      ctx.fillStyle = "#e79ad9";
      for (i = 0; i < this.exploredCount; i++) {
        var q = list[i];
        ctx.fillRect(xs[q] - hs, ys[q] - hs, hs * 2, hs * 2);
      }
    }

    // caminho (sequência) — arestas e nós
    if (this.path && this.path.length) {
      var p = this.path;
      ctx.strokeStyle = "#c53fb6";
      ctx.lineWidth = px(2.8, 2, 6);
      ctx.beginPath();
      for (i = 1; i < p.length; i++) {
        ctx.moveTo(xs[p[i - 1]], ys[p[i - 1]]);
        ctx.lineTo(xs[p[i]], ys[p[i]]);
      }
      ctx.stroke();

      var hp = px(3.2, 1.8, 8);
      ctx.fillStyle = "#c53fb6";
      for (i = 0; i < p.length; i++) {
        ctx.fillRect(xs[p[i]] - hp, ys[p[i]] - hp, hp * 2, hp * 2);
      }
    }

    // anéis
    var self = this;
    function ring(idx, col, rad) {
      if (idx < 0 || idx >= self.n) return;
      ctx.strokeStyle = col;
      ctx.lineWidth = px(2.4, 1.6, 5);
      ctx.beginPath();
      ctx.arc(xs[idx], ys[idx], px(rad, 5, 26), 0, Math.PI * 2);
      ctx.stroke();
    }
    ring(this.currentIdx, "#5b5560", 9);
    ring(this.suggestedIdx, "#c53fb6", 12);

    ctx.restore();
  };

  // ---------------- interação ----------------

  GraphView.prototype._initInteraction = function () {
    var self = this;
    var dragging = false, lx = 0, ly = 0;

    this.canvas.addEventListener("mousedown", function (e) {
      dragging = true; lx = e.clientX; ly = e.clientY;
    });
    global.addEventListener("mouseup", function () { dragging = false; });
    global.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      self.autoFit = false;
      self.ox += e.clientX - lx;
      self.oy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      self.requestDraw();
    });
    this.canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (!self.n) return;
      self.autoFit = false;
      var r = self.canvas.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      var wx = (mx - self.ox) / self.scale;
      var wy = (my - self.oy) / self.scale;
      self.scale *= factor;
      self.ox = mx - wx * self.scale;
      self.oy = my - wy * self.scale;
      self.requestDraw();
    }, { passive: false });
  };

  global.GraphView = GraphView;
})(window);
