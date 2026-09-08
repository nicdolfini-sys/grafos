/* ============================================================
   GraphView — desenha UM grafo estático e recolore a busca sobre ele.

   Modelo:
     setGraph(nodes, edges)  -> define o grafo completo (uma única vez).
                                nodes: Array<[id, depth]>, edges: Array<[a, b]>
     setExplored(ids)        -> conjunto de nós já visitados pela busca atual
     setPath(ids)            -> nós do caminho / linha principal em destaque
     setCurrent(id) / setSuggested(id) -> anéis

   O grafo completo é rasterizado UMA vez para um canvas fora de tela
   (arestas pálidas). A cada quadro só desenhamos por cima: a região
   explorada, o caminho e os anéis. Assim um grafo de ~180 mil nós
   continua deslizável. Layout por camadas (profundidade); a visão é
   propositalmente grosseira.
   ============================================================ */
(function (global) {
  "use strict";

  var MAX_BASE_PX = 3000;

  function GraphView(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nodes = new Map();      // id -> {id, depth, x, y}
    this.edges = [];             // [aId, bId]
    this.layers = new Map();     // depth -> [id...]
    this.exploredSet = new Set();
    this.exploredEdges = [];     // arestas com as duas pontas exploradas
    this.pathSet = new Set();
    this.pathEdges = [];
    this.currentId = null;
    this.suggestedId = null;

    this.scale = 1; this.ox = 0; this.oy = 0;
    this.autoFit = true;
    this._raf = null;
    this._baseDirty = true;
    this._base = document.createElement("canvas");

    this._initInteraction();
    this._resize();
    var self = this;
    window.addEventListener("resize", function () {
      self._resize();
      self._baseDirty = true;
      if (self.autoFit) self.fit();
      else self.requestDraw();
    });
  }

  GraphView.prototype.count = function () {
    return { nodes: this.nodes.size, edges: this.edges.length };
  };

  GraphView.prototype.clear = function () {
    this.nodes.clear();
    this.edges = [];
    this.layers.clear();
    this.exploredSet.clear();
    this.exploredEdges = [];
    this.pathSet.clear();
    this.pathEdges = [];
    this.currentId = null;
    this.suggestedId = null;
    this.autoFit = true;
    this._baseDirty = true;
    this.requestDraw();
  };

  // ---- define o grafo completo (uma vez) ----
  GraphView.prototype.setGraph = function (nodes, edges) {
    this._resize(); // o canvas pode ter sido construído escondido
    this.nodes.clear();
    this.layers.clear();
    this.edges = edges || [];
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i][0], d = nodes[i][1] || 0;
      var node = { id: id, depth: d, x: 0, y: 0 };
      this.nodes.set(id, node);
      if (!this.layers.has(d)) this.layers.set(d, []);
      this.layers.get(d).push(id);
    }
    this.exploredSet.clear();
    this.exploredEdges = [];
    this.pathSet.clear();
    this.pathEdges = [];
    this._layout();
    this._baseDirty = true;
    this.fit();
  };

  GraphView.prototype.setExplored = function (ids) {
    this.exploredSet = ids instanceof Set ? ids : new Set(ids || []);
    var s = this.exploredSet, out = [];
    for (var i = 0; i < this.edges.length; i++) {
      var e = this.edges[i];
      if (s.has(e[0]) && s.has(e[1])) out.push(e);
    }
    this.exploredEdges = out;
    this.requestDraw();
  };

  GraphView.prototype.setPath = function (ids) {
    this.pathSet = new Set(ids || []);
    var s = this.pathSet, out = [];
    for (var i = 0; i < this.edges.length; i++) {
      var e = this.edges[i];
      if (s.has(e[0]) && s.has(e[1])) out.push(e);
    }
    this.pathEdges = out;
    this.requestDraw();
  };

  GraphView.prototype.setCurrent = function (id) { this.currentId = id; this.requestDraw(); };
  GraphView.prototype.setSuggested = function (id) { this.suggestedId = id; this.requestDraw(); };

  // ---- layout por camadas ----
  GraphView.prototype._layout = function () {
    var depths = Array.from(this.layers.keys()).sort(function (a, b) { return a - b; });
    var maxLayer = 1;
    for (var i = 0; i < depths.length; i++) {
      maxLayer = Math.max(maxLayer, this.layers.get(depths[i]).length);
    }
    var yGap = 96;
    var widthCap = Math.max((this.viewW || 700) * 2.4, 2200);
    var xGap = Math.min(28, widthCap / maxLayer);
    this.worldW = Math.max(this.viewW || 700, Math.min(widthCap, maxLayer * xGap) + 40);
    this.worldH = Math.max(this.viewH || 500, depths.length * yGap + 40);

    for (var d = 0; d < depths.length; d++) {
      var arr = this.layers.get(depths[d]);
      var n = arr.length;
      var span = Math.min(this.worldW - 40, Math.max(1, n) * xGap);
      var startX = (this.worldW - span) / 2;
      for (var k = 0; k < n; k++) {
        var node = this.nodes.get(arr[k]);
        node.x = startX + (n <= 1 ? span / 2 : (k * span) / (n - 1));
        node.y = 34 + d * yGap;
      }
    }
  };

  // ---- rasteriza o grafo completo (arestas pálidas) uma vez ----
  GraphView.prototype._rasterBase = function () {
    var scale = Math.min(MAX_BASE_PX / this.worldW, MAX_BASE_PX / this.worldH, 2);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    this._baseScale = scale;
    var b = this._base;
    b.width = Math.max(1, Math.round(this.worldW * scale));
    b.height = Math.max(1, Math.round(this.worldH * scale));
    var g = b.getContext("2d");
    g.clearRect(0, 0, b.width, b.height);
    g.setTransform(scale, 0, 0, scale, 0, 0);

    g.strokeStyle = "rgba(231, 170, 220, 0.30)";
    g.lineWidth = 1 / scale;
    g.beginPath();
    for (var i = 0; i < this.edges.length; i++) {
      var a = this.nodes.get(this.edges[i][0]);
      var c = this.nodes.get(this.edges[i][1]);
      if (!a || !c) continue;
      g.moveTo(a.x, a.y); g.lineTo(c.x, c.y);
    }
    g.stroke();

    // pontos só quando não são muitos (senão viram uma mancha mesmo)
    if (this.nodes.size <= 24000) {
      g.fillStyle = "rgba(214, 150, 205, 0.55)";
      var h = 2 / scale;
      this.nodes.forEach(function (node) {
        g.fillRect(node.x - h, node.y - h, h * 2, h * 2);
      });
    }
    this._baseDirty = false;
  };

  GraphView.prototype.fit = function () {
    if (this.viewW <= 1 || this.viewH <= 1) this._resize();
    var s = Math.min(this.viewW / this.worldW, this.viewH / this.worldH) * 0.92;
    this.scale = s > 0 && isFinite(s) ? s : 1;
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

  GraphView.prototype._resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = global.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.viewW = r.width || 1;
    this.viewH = r.height || 1;
    this.dpr = dpr;
  };

  GraphView.prototype._draw = function () {
    if (!this.nodes.size) {
      var c0 = this.ctx;
      c0.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c0.clearRect(0, 0, this.viewW, this.viewH);
      return;
    }
    if (!(this.scale > 0) || !isFinite(this.scale) ||
        this.viewW <= 1 || this.viewH <= 1) {
      this._resize();
      this.fit();
      return;
    }
    if (this._baseDirty) this._rasterBase();

    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    // tamanho de pontos/traços em px de tela, limitado (evita explosão se
    // o zoom estiver minúsculo)
    var px = function (worldUnits, min, max) {
      return Math.max(min, Math.min(max, worldUnits / this.scale));
    }.bind(this);

    // base (grafo completo) como bitmap, posicionado pela transformação atual
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._base, 0, 0, this._base.width, this._base.height,
      this.ox, this.oy, this.worldW * this.scale, this.worldH * this.scale);

    // overlay vetorial: só o que muda por jogada
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    var i, a, b;

    // arestas exploradas
    if (this.exploredEdges.length) {
      ctx.strokeStyle = "rgba(197, 63, 182, 0.28)";
      ctx.lineWidth = px(1.1, 0.5, 4);
      ctx.beginPath();
      for (i = 0; i < this.exploredEdges.length; i++) {
        a = this.nodes.get(this.exploredEdges[i][0]);
        b = this.nodes.get(this.exploredEdges[i][1]);
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }

    // nós explorados
    if (this.exploredSet.size && this.exploredSet.size < 60000) {
      ctx.fillStyle = "#e79ad9";
      var hs = px(2.4, 1, 6);
      var self = this;
      this.exploredSet.forEach(function (id) {
        var nd = self.nodes.get(id);
        if (nd) ctx.fillRect(nd.x - hs, nd.y - hs, hs * 2, hs * 2);
      });
    }

    // arestas do caminho
    ctx.strokeStyle = "#c53fb6";
    ctx.lineWidth = px(2.8, 1.8, 6);
    ctx.beginPath();
    for (i = 0; i < this.pathEdges.length; i++) {
      a = this.nodes.get(this.pathEdges[i][0]);
      b = this.nodes.get(this.pathEdges[i][1]);
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // nós do caminho
    ctx.fillStyle = "#c53fb6";
    var hp = px(3.2, 1.6, 8);
    this.pathSet.forEach(function (id) {
      var nd = this.nodes.get(id);
      if (nd) ctx.fillRect(nd.x - hp, nd.y - hp, hp * 2, hp * 2);
    }, this);

    // anéis
    var vv = this;
    function ring(id, col, rad) {
      var nd = vv.nodes.get(id);
      if (!nd) return;
      ctx.strokeStyle = col;
      ctx.lineWidth = px(2.4, 1.6, 5);
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, px(rad, 5, 26), 0, Math.PI * 2);
      ctx.stroke();
    }
    ring(this.currentId, "#5b5560", 9);
    ring(this.suggestedId, "#c53fb6", 12);

    ctx.restore();
  };

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
