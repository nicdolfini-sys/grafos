/* ============================================================
   Eight Puzzle (3x3) — BFS sobre UM grafo estático de estados

   - O grafo COMPLETO das configurações solúveis (9!/2 = 181 440 nós) é
     construído UMA vez, ao escolher a primeira imagem, e nunca mais muda.
   - A cada jogada, a BFS (idêntica ao pseudocódigo) roda a partir do
     estado atual e o resultado é apenas RECOLORIDO sobre esse mesmo grafo:
       • estados visitados pela BFS -> "explorado"
       • reconstruct(pai, objetivo) -> caminho mínimo em destaque
   - A peça vazia usa uma cor saturada da paleta da personagem.
   - Dá para jogar com ou sem a sugestão (botão "ocultar/mostrar sugestão").

   Pseudocódigo:
     from collections import deque
     def solve(start, goal):
         queue = deque([start]); parent = {start: None}
         while queue:
             state = queue.popleft()
             if state == goal: return reconstruct(parent, state)
             for nxt in neighbors(state):
                 if nxt not in parent:
                     parent[nxt] = state
                     queue.append(nxt)
   ============================================================ */
(function () {
  "use strict";

  var GOAL = "012345678";
  var TOTAL = 181440; // 9! / 2

  var CHARACTERS = [
    { file: "list-hellokitty.png",   name: "Hello Kitty",    bg: "#FFF0F0" },
    { file: "list-mymelody.png",     name: "My Melody",      bg: "#FCEFF7" },
    { file: "list-kuromi.png",       name: "Kuromi",         bg: "#F5F0FA" },
    { file: "list-cinnamon.png",     name: "Cinnamoroll",    bg: "#EDF9FC" },
    { file: "list-pompompurin.png",  name: "Pompompurin",    bg: "#FFFBE0" },
    { file: "list-keroppi.png",      name: "Keroppi",        bg: "#F4F9DE" },
    { file: "list-badtzmaru-1.png",  name: "Badtz-Maru",     bg: "#F5F0FA" },
    { file: "list-pochacco.png",     name: "Pochacco",       bg: "#F4F9DE" },
    { file: "list-mysweetpiano.png", name: "My Sweet Piano", bg: "#FCEFF7" },
    { file: "list-gudetama.png",     name: "Gudetama",       bg: "#FFFBE0" }
  ];

  var DECO = ["⋆", "✧", "♡", "✦", "❀", "✿", "❁", "✩", "★", "❃"];

  // ---------- cor saturada da paleta (para a peça vazia) ----------
  function hexToRgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), h, s, l = (mx + mn) / 2;
    if (mx === mn) { h = s = 0; }
    else {
      var d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function vividFrom(hex) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    // mesma matiz da paleta, porém bem saturada (a "cor destaque" do jogo)
    var s = Math.min(0.8, Math.max(0.6, hsl[1]));
    return "hsl(" + Math.round(hsl[0] * 360) + ", " +
      Math.round(s * 100) + "%, 57%)";
  }

  // ---------- grafo do puzzle ----------
  function neighbors(s) {
    var z = s.indexOf("8");
    var r = (z / 3) | 0, c = z % 3;
    var out = [];
    if (r > 0) out.push(swap(s, z, z - 3));
    if (r < 2) out.push(swap(s, z, z + 3));
    if (c > 0) out.push(swap(s, z, z - 1));
    if (c < 2) out.push(swap(s, z, z + 1));
    return out;
  }
  function swap(s, i, j) {
    var a = s.split("");
    var t = a[i]; a[i] = a[j]; a[j] = t;
    return a.join("");
  }
  function reconstruct(parent, state) {
    var path = [];
    while (state !== null && state !== undefined) {
      path.push(state);
      state = parent.get(state);
    }
    return path.reverse();
  }
  function scramble(depth) {
    var s = GOAL, prev = null;
    for (var i = 0; i < depth; i++) {
      var nb = neighbors(s).filter(function (x) { return x !== prev; });
      var pick = nb[(Math.random() * nb.length) | 0];
      prev = s;
      s = pick;
    }
    return s === GOAL ? scramble(depth) : s;
  }

  // ---------- construção do grafo completo (1x, em pedaços) ----------
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");
  var fullGraphReady = false;

  function buildFullGraph(onProgress, onDone) {
    var dist = new Map([[GOAL, 0]]);
    var order = [GOAL];
    var head = 0;

    function flood() {
      var budget = 14000, n = 0;
      while (head < order.length && n < budget) {
        var s = order[head++];
        var d = dist.get(s);
        var nb = neighbors(s);
        for (var i = 0; i < nb.length; i++) {
          if (!dist.has(nb[i])) { dist.set(nb[i], d + 1); order.push(nb[i]); }
        }
        n++;
      }
      onProgress(dist.size / TOTAL * 0.55);
      if (head < order.length) setTimeout(flood, 0);
      else buildArrays();
    }

    function buildArrays() {
      var nodes = new Array(order.length);
      for (var i = 0; i < order.length; i++) nodes[i] = [order[i], dist.get(order[i])];

      var edges = [];
      var ei = 0;
      function edgePass() {
        var budget = 16000, n = 0;
        while (ei < order.length && n < budget) {
          var s = order[ei++];
          var nb = neighbors(s);
          for (var i = 0; i < nb.length; i++) {
            if (s < nb[i]) edges.push([s, nb[i]]); // cada par sem repetir
          }
          n++;
        }
        onProgress(0.55 + (ei / order.length) * 0.4);
        if (ei < order.length) setTimeout(edgePass, 0);
        else {
          onProgress(0.98);
          setTimeout(function () {
            graph.setGraph(nodes, edges);
            var c = graph.count();
            countEl.textContent = c.nodes.toLocaleString("pt-BR") + " nós · " +
              c.edges.toLocaleString("pt-BR") + " arestas (grafo fixo)";
            fullGraphReady = true;
            onDone();
          }, 0);
        }
      }
      edgePass();
    }

    flood();
  }

  // ---------- BFS + recolorir a busca no grafo fixo ----------
  var runToken = 0;
  function searchAndReveal(start, onDone) {
    var token = ++runToken;

    // BFS igual ao pseudocódigo
    var queue = [start];
    var head = 0;
    var parent = new Map([[start, null]]);
    var visitOrder = [];
    var found = null;
    while (head < queue.length) {
      var state = queue[head++];
      visitOrder.push(state);
      if (state === GOAL) { found = reconstruct(parent, state); break; }
      var nb = neighbors(state);
      for (var i = 0; i < nb.length; i++) {
        if (!parent.has(nb[i])) { parent.set(nb[i], state); queue.push(nb[i]); }
      }
    }

    graph.setCurrent(start);
    graph.setPath([]);
    graph.setSuggested(null);

    // anima a região visitada crescendo sobre o grafo fixo
    var shown = new Set();
    var i = 0;
    var budget = Math.max(8, Math.ceil(visitOrder.length / 55));
    function step() {
      if (token !== runToken) return;
      var n = 0;
      while (i < visitOrder.length && n < budget) { shown.add(visitOrder[i++]); n++; }
      graph.setExplored(shown);
      if (i < visitOrder.length) {
        setTimeout(step, 16);
      } else {
        if (found) {
          graph.setPath(found);
          if (showHint) graph.setSuggested(found.length > 1 ? found[1] : null);
        }
        onDone(found);
      }
    }
    step();
  }

  // ---------- DOM / estado ----------
  var pickerEl = document.getElementById("picker");
  var gameEl = document.getElementById("game");
  var gridEl = document.getElementById("char-grid");
  var boardEl = document.getElementById("board");
  var statusEl = document.getElementById("status");
  var nameEl = document.getElementById("game-name");
  var depthInput = document.getElementById("depth");
  var depthVal = document.getElementById("depth-val");
  var btnShuffle = document.getElementById("btn-shuffle");
  var btnHint = document.getElementById("btn-hint");
  var btnHintToggle = document.getElementById("btn-hint-toggle");
  var btnSolve = document.getElementById("btn-solve");
  var btnChange = document.getElementById("btn-change");

  var showHint = true;
  var current = { char: null, state: GOAL, path: null, hintIndex: -1, solving: false };

  function setStatus(html) { statusEl.innerHTML = html; }

  function buildPicker() {
    gridEl.innerHTML = "";
    CHARACTERS.forEach(function (ch, i) {
      var card = document.createElement("div");
      card.className = "char-card";
      card.style.background = ch.bg;
      card.innerHTML =
        '<img src="img/puzzle/' + ch.file + '" alt="' + ch.name + '" loading="lazy" />' +
        '<span class="char-card__deco">' + DECO[i % DECO.length] + " ˚ ✧ ˚ " +
        DECO[(i + 3) % DECO.length] + "</span>" +
        '<div class="char-card__name">' + ch.name + "</div>";
      card.addEventListener("click", function () { chooseCharacter(ch, card); });
      gridEl.appendChild(card);
    });
  }

  function chooseCharacter(ch, card) {
    current.char = ch;
    Array.prototype.forEach.call(gridEl.children, function (c) { c.classList.remove("-active"); });
    if (card) card.classList.add("-active");
    nameEl.textContent = ch.name;
    boardEl.style.setProperty("--blank", vividFrom(ch.bg));
    gameEl.classList.remove("hidden");
    gameEl.scrollIntoView({ behavior: "smooth", block: "start" });

    if (fullGraphReady) {
      doShuffle();
    } else {
      setControls(true);
      setStatus('<span class="tag">montando</span> Construindo o grafo completo ' +
        "das 181.440 configurações (só uma vez)… <b id=\"bp\">0%</b>");
      buildFullGraph(function (p) {
        var bp = document.getElementById("bp");
        if (bp) bp.textContent = Math.round(p * 100) + "%";
      }, function () {
        setControls(false);
        doShuffle();
      });
    }
  }

  function renderBoard() {
    var s = current.state;
    var url = 'url("img/puzzle/' + current.char.file + '")';
    boardEl.innerHTML = "";
    for (var i = 0; i < 9; i++) {
      var v = s[i];
      var tile = document.createElement("button");
      tile.className = "puzzle-tile";
      if (v === "8") {
        tile.classList.add("-blank");
        tile.style.background = "var(--blank)";
      } else {
        var col = (+v) % 3, row = ((+v) / 3) | 0;
        tile.style.backgroundImage = url;
        tile.style.backgroundPosition = (col * 50) + "% " + (row * 50) + "%";
      }
      if (showHint && i === current.hintIndex && v !== "8") tile.classList.add("-hint");
      (function (idx) {
        tile.addEventListener("click", function () { tryMove(idx); });
      })(i);
      boardEl.appendChild(tile);
    }
  }

  function tryMove(idx) {
    if (current.solving) return;
    var s = current.state;
    var z = s.indexOf("8");
    var adj = (Math.abs((idx % 3) - (z % 3)) + Math.abs(((idx / 3) | 0) - ((z / 3) | 0))) === 1;
    if (!adj) return;
    current.state = swap(s, z, idx);
    afterStateChange();
  }

  function afterStateChange() {
    renderBoard();
    if (current.state === GOAL) {
      current.path = [GOAL];
      current.hintIndex = -1;
      runToken++;
      graph.setExplored([GOAL]);
      graph.setPath([GOAL]);
      graph.setCurrent(GOAL);
      graph.setSuggested(null);
      setStatus('<span class="tag">resolvido</span> <b>Montou! ✧ · ♡ · ✧</b> ' +
        "Embaralhe de novo ou troque a imagem.");
      if (typeof celebrate === "function") celebrate("win");
      return;
    }
    setStatus('<span class="tag">bfs</span> Rodando a busca sobre o grafo fixo…');
    searchAndReveal(current.state, onSearched);
  }

  function onSearched(path) {
    if (!path) { setStatus("Sem solução encontrada."); return; }
    current.path = path;
    var moves = path.length - 1;
    current.hintIndex = path[1].indexOf("8");
    renderBoard();
    var tail = showHint
      ? "Peça sugerida em destaque — clique nela ou use “aplicar sugestão”."
      : "Sugestão oculta. Ative em “mostrar sugestão” quando quiser.";
    setStatus('<span class="tag">bfs</span> Caminho mínimo: <b>' + moves +
      (moves === 1 ? " movimento" : " movimentos") + "</b>. " + tail);
  }

  function doShuffle() {
    if (current.solving) return;
    current.state = scramble(+depthInput.value);
    current.hintIndex = -1;
    afterStateChange();
  }

  function applyHint() {
    if (current.solving || !current.path || current.path.length < 2) return;
    current.state = current.path[1];
    afterStateChange();
  }

  function solveAll() {
    if (current.solving || !current.path || current.path.length < 2) return;
    current.solving = true;
    setControls(true);

    function stepAlong() {
      if (!current.solving) { setControls(false); return; }
      if (current.state === GOAL) {
        current.solving = false;
        setControls(false);
        afterStateChange();
        return;
      }
      searchAndReveal(current.state, function (path) {
        if (!path || path.length < 2) {
          current.solving = false;
          setControls(false);
          onSearched(path);
          return;
        }
        current.path = path;
        current.hintIndex = path[1].indexOf("8");
        current.state = path[1];
        renderBoard();
        setStatus('<span class="tag">resolvendo</span> ' + (path.length - 2) +
          " movimento(s) restante(s)…");
        setTimeout(stepAlong, 460);
      });
    }
    stepAlong();
  }

  function setControls(lock) {
    btnShuffle.disabled = lock;
    btnHint.disabled = lock;
    btnHintToggle.disabled = lock;
    btnChange.disabled = lock;
    depthInput.disabled = lock;
    btnSolve.textContent = lock && current.solving ? "parar" : "resolver";
    btnSolve.disabled = lock && !current.solving;
  }

  // ---------- eventos ----------
  depthInput.addEventListener("input", function () {
    depthVal.textContent = depthInput.value;
  });
  btnShuffle.addEventListener("click", doShuffle);
  btnHint.addEventListener("click", applyHint);
  btnHintToggle.addEventListener("click", function () {
    showHint = !showHint;
    btnHintToggle.textContent = showHint ? "ocultar sugestão" : "mostrar sugestão";
    btnHint.disabled = !showHint;
    current.hintIndex = showHint && current.path && current.path.length > 1
      ? current.path[1].indexOf("8") : -1;
    renderBoard();
    if (current.state !== GOAL && current.path && current.path.length > 1) {
      graph.setSuggested(showHint ? current.path[1] : null);
    }
    if (current.path) {
      onSearched(current.path);
    }
  });
  btnSolve.addEventListener("click", function () {
    if (current.solving) {
      current.solving = false;
      setControls(false);
      setStatus('<span class="tag">pausado</span> Resolução interrompida.');
    } else {
      solveAll();
    }
  });
  btnChange.addEventListener("click", function () {
    runToken++;
    current.solving = false;
    setControls(false);
    gameEl.classList.add("hidden");
    pickerEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("btn-fit").addEventListener("click", function (e) {
    e.preventDefault();
    graph.fit();
  });

  buildPicker();

  // atalho: #hellokitty na URL já abre aquela imagem
  var hash = (location.hash || "").replace("#", "").toLowerCase();
  if (hash) {
    for (var i = 0; i < CHARACTERS.length; i++) {
      var slug = CHARACTERS[i].file.replace(/^list-/, "").replace(/(-1)?\.png$/, "");
      if (slug === hash) { chooseCharacter(CHARACTERS[i], gridEl.children[i]); break; }
    }
  }
})();
