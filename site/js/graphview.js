/* ============================================================
   GraphView — desenho "grosseiro" de grafos grandes em canvas
   Layout por camadas (profundidade). Pan com arrastar, zoom com a roda.
   Usado tanto pelo BFS do 8-puzzle quanto pelo DFS do jogo da velha.
   ============================================================ */
(function (global) {
  "use strict";

  function GraphView(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.nodes = new Map();     // id -> {id, depth, kind, x, y}
    this.edges = [];            // [fromId, toId]
    this.edgeSet = new Set();   // "from>to" para deduplicar
    this.layers = new Map();    // depth -> [id, ...]
    this.pathSet = new Set();   // ids do caminho destacado
    this.currentId = null;
    this.suggestedId = null;
    this.scale = 1;
    this.ox = 0;
    this.oy = 0;
    this.autoFit = true;
    this._raf = null;
    this._layoutDirty = true;

    this._initInteraction();
    this._resize();
    var self = this;
    window.addEventListener("resize", function () {
      self._resize();
      if (self.autoFit) self.fit();
      else self.requestDraw();
    });
  }

  GraphView.prototype.clear = function () {
    this.nodes.clear();
    this.edges.length = 0;
    this.edgeSet.clear();
    this.layers.clear();
    this.pathSet.clear();
    this.currentId = null;
    this.suggestedId = null;
    this.autoFit = true;
    this._layoutDirty = true;
    this.requestDraw();
  };

  GraphView.prototype.addNode = function (id, depth, kind) {
    var node = this.nodes.get(id);
    if (node) {
      if (kind) node.kind = kind;
      return;
    }
    node = { id: id, depth: depth || 0, kind: kind || "seen", x: 0, y: 0 };
    this.nodes.set(id, node);
    if (!this.layers.has(node.depth)) this.layers.set(node.depth, []);
    this.layers.get(node.depth).push(id);
    this._layoutDirty = true;
  };

  GraphView.prototype.addEdge = function (a, b) {
    var key = a + ">" + b;
    if (this.edgeSet.has(key)) return;
    this.edgeSet.add(key);
    this.edges.push([a, b]);
  };

  GraphView.prototype.setPath = function (ids) {
    this.pathSet = new Set(ids || []);
    this.requestDraw();
  };
  GraphView.prototype.setCurrent = function (id) {
    this.currentId = id;
    this.requestDraw();
  };
  GraphView.prototype.setSuggested = function (id) {
    this.suggestedId = id;
    this.requestDraw();
  };

  GraphView.prototype.count = function () {
    return { nodes: this.nodes.size, edges: this.edges.length };
  };

  GraphView.prototype._resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = global.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.viewW = r.width || 1;
    this.viewH = r.height || 1;
    this.dpr = dpr;
    this._layoutDirty = true;
  };

  GraphView.prototype._layout = function () {
    var depths = Array.from(this.layers.keys()).sort(function (a, b) { return a - b; });
    var maxLayer = 1;
    for (var i = 0; i < depths.length; i++) {
      maxLayer = Math.max(maxLayer, this.layers.get(depths[i]).length);
    }
    // Camadas empilhadas na vertical; largura limitada para nao "achatar"
    // tudo numa faixa fina (as arestas podem se cruzar — visao grosseira).
    var yGap = 96;
    var widthCap = Math.max(this.viewW * 2.4, 2200);
    var xGap = Math.min(28, widthCap / maxLayer);
    this.worldW = Math.max(this.viewW, Math.min(widthCap, maxLayer * xGap) + 40);
    this.worldH = Math.max(this.viewH, depths.length * yGap + 40);

    for (var d = 0; d < depths.length; d++) {
      var arr = this.layers.get(depths[d]);
      var n = arr.length;
      var span = Math.min(this.worldW - 40, n * xGap);
      var startX = (this.worldW - span) / 2;
      for (var k = 0; k < n; k++) {
        var node = this.nodes.get(arr[k]);
        node.x = startX + (n <= 1 ? span / 2 : (k * span) / (n - 1));
        node.y = 34 + d * yGap;
      }
    }
    this._layoutDirty = false;
  };

  GraphView.prototype.fit = function () {
    if (this._layoutDirty) this._layout();
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

  GraphView.prototype._draw = function () {
    if (this._layoutDirty) {
      this._layout();
      if (this.autoFit) {
        var s = Math.min(this.viewW / this.worldW, this.viewH / this.worldH) * 0.92;
        this.scale = s > 0 && isFinite(s) ? s : 1;
        this.ox = (this.viewW - this.worldW * this.scale) / 2;
        this.oy = (this.viewH - this.worldH * this.scale) / 2;
      }
    }
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    var i, a, b;

    // arestas comuns
    ctx.lineWidth = Math.max(0.4, 1 / this.scale);
    ctx.strokeStyle = "rgba(226, 160, 216, 0.4)";
    ctx.beginPath();
    for (i = 0; i < this.edges.length; i++) {
      a = this.nodes.get(this.edges[i][0]);
      b = this.nodes.get(this.edges[i][1]);
      if (!a || !b) continue;
      if (this.pathSet.has(a.id) && this.pathSet.has(b.id)) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // arestas do caminho destacado
    ctx.lineWidth = Math.max(1.6, 2.6 / this.scale);
    ctx.strokeStyle = "#c53fb6";
    ctx.beginPath();
    for (i = 0; i < this.edges.length; i++) {
      a = this.nodes.get(this.edges[i][0]);
      b = this.nodes.get(this.edges[i][1]);
      if (!a || !b) continue;
      if (this.pathSet.has(a.id) && this.pathSet.has(b.id)) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();

    // nos
    var half = Math.max(1.1, 3 / this.scale);
    this.nodes.forEach(function (node) {
      var color = "#f2b8ea";
      if (node.kind === "start") color = "#7a6f80";
      else if (node.kind === "goal") color = "#4caf7d";
      if (this.pathSet.has(node.id)) color = "#c53fb6";
      ctx.fillStyle = color;
      ctx.fillRect(node.x - half, node.y - half, half * 2, half * 2);
    }, this);

    // aneis: no atual e sugestao
    var self = this;
    function ring(id, col, rad) {
      var node = self.nodes.get(id);
      if (!node) return;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1.6, 2.4 / self.scale);
      ctx.beginPath();
      ctx.arc(node.x, node.y, rad / self.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ring(this.currentId, "#5b5560", 8);
    ring(this.suggestedId, "#c53fb6", 11);

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
