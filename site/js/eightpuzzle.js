/* ============================================================
   Eight Puzzle (3x3) — BFS sobre UM grafo estático de estados

   - O grafo COMPLETO das configurações solúveis (9!/2 = 181 440 nós,
     241 920 arestas) é construído UMA vez e nunca mais muda.
   - A cada jogada a BFS roda a partir do estado atual e o resultado é
     apenas RECOLORIDO sobre esse mesmo grafo.
   - Tudo é guardado em typed arrays com os estados codificados como
     inteiros (base 9). Sem isso, 181 mil objetos/strings travariam a aba.

   Pseudocódigo seguido à risca:
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

  var GOAL_STR = "012345678";
  var TOTAL = 181440;         // 9! / 2
  var DIR_EDGES = 483840;     // arestas dirigidas
  var UND_EDGES = 241920;     // arestas não dirigidas

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

  // ---------- cor saturada da paleta (peça vazia) ----------
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
    var s = Math.min(0.8, Math.max(0.6, hsl[1]));
    return "hsl(" + Math.round(hsl[0] * 360) + ", " + Math.round(s * 100) + "%, 57%)";
  }

  // ---------- estados como inteiros (9 dígitos base 9) ----------
  function encode(s) {
    var v = 0;
    for (var i = 0; i < 9; i++) v = v * 9 + (s.charCodeAt(i) - 48);
    return v;
  }
  function decode(v) {
    var a = new Array(9);
    for (var i = 8; i >= 0; i--) { a[i] = String.fromCharCode(48 + (v % 9)); v = (v / 9) | 0; }
    return a.join("");
  }
  var dbuf = new Uint8Array(9);
  function digitsInto(v, out) {
    for (var i = 8; i >= 0; i--) { out[i] = v % 9; v = (v / 9) | 0; }
  }
  function fromDigits(a) {
    var v = 0;
    for (var i = 0; i < 9; i++) v = v * 9 + a[i];
    return v;
  }

  // vizinhos de um estado (inteiro): desliza uma peça para o vazio ('8')
  var nbuf = new Int32Array(4);
  function neighborsOf(v) {
    digitsInto(v, dbuf);
    var z = 0;
    for (var i = 0; i < 9; i++) if (dbuf[i] === 8) { z = i; break; }
    var r = (z / 3) | 0, c = z % 3, k = 0, t;
    if (r > 0) { t = dbuf[z - 3]; dbuf[z - 3] = 8; dbuf[z] = t; nbuf[k++] = fromDigits(dbuf); dbuf[z] = 8; dbuf[z - 3] = t; }
    if (r < 2) { t = dbuf[z + 3]; dbuf[z + 3] = 8; dbuf[z] = t; nbuf[k++] = fromDigits(dbuf); dbuf[z] = 8; dbuf[z + 3] = t; }
    if (c > 0) { t = dbuf[z - 1]; dbuf[z - 1] = 8; dbuf[z] = t; nbuf[k++] = fromDigits(dbuf); dbuf[z] = 8; dbuf[z - 1] = t; }
    if (c < 2) { t = dbuf[z + 1]; dbuf[z + 1] = 8; dbuf[z] = t; nbuf[k++] = fromDigits(dbuf); dbuf[z] = 8; dbuf[z + 1] = t; }
    return k;
  }

  // ---------- grafo completo (construído 1x, em lotes) ----------
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");

  var idxOf = null;       // Map<estadoInt, índice>
  var stateOf = null;     // Int32Array: índice -> estadoInt
  var depthArr = null;    // Uint8Array: índice -> distância até o objetivo
  var adjStart = null;    // Int32Array(n+1)
  var adjList = null;     // Int32Array(DIR_EDGES)
  var nNodes = 0;
  var GOAL_IDX = 0;       // por construção, o objetivo é o índice 0
  var fullGraphReady = false;

  function buildFullGraph(onProgress, onDone, onError) {
    try {
      idxOf = new Map();
      stateOf = new Int32Array(TOTAL);
      depthArr = new Uint8Array(TOTAL);
      adjStart = new Int32Array(TOTAL + 1);
      adjList = new Int32Array(DIR_EDGES);
    } catch (err) {
      onError("memória insuficiente para o grafo completo");
      return;
    }

    var g0 = encode(GOAL_STR);
    idxOf.set(g0, 0);
    stateOf[0] = g0;
    depthArr[0] = 0;
    nNodes = 1;
    var head = 0;

    // fase 1: descobre todos os estados (BFS a partir do objetivo).
    // a própria ordem dos índices é a ordem da BFS.
    function flood() {
      try {
        var budget = 20000, done = 0;
        while (head < nNodes && done < budget) {
          var v = stateOf[head];
          var d = depthArr[head];
          head++;
          var k = neighborsOf(v);
          for (var i = 0; i < k; i++) {
            var nv = nbuf[i];
            if (!idxOf.has(nv)) {
              idxOf.set(nv, nNodes);
              stateOf[nNodes] = nv;
              depthArr[nNodes] = d + 1;
              nNodes++;
            }
          }
          done++;
        }
        onProgress(0.45 * (nNodes / TOTAL));
        if (head < nNodes) setTimeout(flood, 0);
        else adjacency();
      } catch (err) { onError(err.message || String(err)); }
    }

    // fase 2: lista de adjacência (CSR) + arestas não dirigidas
    var edges = null;
    var cur = 0, ei = 0, ai = 0;
    function adjacency() {
      try {
        if (!edges) edges = new Int32Array(UND_EDGES * 2);
        var budget = 15000, done = 0;
        while (ai < nNodes && done < budget) {
          adjStart[ai] = cur;
          var k = neighborsOf(stateOf[ai]);
          for (var i = 0; i < k; i++) {
            var j = idxOf.get(nbuf[i]);
            adjList[cur++] = j;
            if (ai < j) { edges[ei++] = ai; edges[ei++] = j; }
          }
          ai++; done++;
        }
        onProgress(0.45 + 0.3 * (ai / nNodes));
        if (ai < nNodes) setTimeout(adjacency, 0);
        else {
          adjStart[nNodes] = cur;
          handOver(edges.subarray(0, ei));
        }
      } catch (err) { onError(err.message || String(err)); }
    }

    function handOver(edgeArr) {
      graph.setGraph(
        { depths: depthArr.subarray(0, nNodes), edges: edgeArr },
        function (p) { onProgress(0.75 + 0.25 * p); },
        function () {
          var c = graph.count();
          countEl.textContent = c.nodes.toLocaleString("pt-BR") + " nós · " +
            c.edges.toLocaleString("pt-BR") + " arestas (grafo fixo)";
          fullGraphReady = true;
          onDone();
        }
      );
    }

    flood();
  }

  // ---------- BFS (pseudocódigo) sobre o grafo fixo ----------
  var bfsSeen = null, bfsParent = null, bfsQueue = null;

  function bfsFrom(startIdx) {
    if (!bfsSeen) {
      bfsSeen = new Uint8Array(TOTAL);
      bfsParent = new Int32Array(TOTAL);
      bfsQueue = new Int32Array(TOTAL);
    }
    bfsSeen.fill(0);

    var head = 0, tail = 0;
    bfsQueue[tail++] = startIdx;
    bfsSeen[startIdx] = 1;
    bfsParent[startIdx] = -1;

    var visited = 0, found = false;
    while (head < tail) {
      var u = bfsQueue[head++];
      visited = head;
      if (u === GOAL_IDX) { found = true; break; }
      for (var p = adjStart[u], q = adjStart[u + 1]; p < q; p++) {
        var w = adjList[p];
        if (!bfsSeen[w]) {
          bfsSeen[w] = 1;
          bfsParent[w] = u;
          bfsQueue[tail++] = w;
        }
      }
    }

    // reconstruct(parent, goal)
    var path = null;
    if (found) {
      path = [];
      for (var c = GOAL_IDX; c !== -1; c = bfsParent[c]) path.push(c);
      path.reverse();
    }
    return { visited: visited, path: path };
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
  var current = { char: null, state: GOAL_STR, idx: 0, path: null, hintIndex: -1, solving: false };

  function setStatus(html) { statusEl.innerHTML = html; }

  function scramble(depth) {
    var s = GOAL_STR, prev = null;
    for (var i = 0; i < depth; i++) {
      var v = encode(s);
      var k = neighborsOf(v);
      var opts = [];
      for (var j = 0; j < k; j++) {
        var cand = decode(nbuf[j]);
        if (cand !== prev) opts.push(cand);
      }
      prev = s;
      s = opts[(Math.random() * opts.length) | 0];
    }
    return s === GOAL_STR ? scramble(depth) : s;
  }

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

    if (fullGraphReady) { doShuffle(); return; }

    setControls(true);
    setStatus('<span class="tag">montando</span> Montando o grafo completo das ' +
      '181.440 configurações (só uma vez): <b id="bp">0%</b>' +
      '<span class="bar"><i id="bpi"></i></span>');
    buildFullGraph(
      function (p) {
        var pc = Math.min(100, Math.round(p * 100));
        var bp = document.getElementById("bp");
        var bpi = document.getElementById("bpi");
        if (bp) bp.textContent = pc + "%";
        if (bpi) bpi.style.width = pc + "%";
      },
      function () { setControls(false); doShuffle(); },
      function (msg) {
        setControls(false);
        setStatus('<span class="tag">erro</span> Não deu para montar o grafo ' +
          "completo aqui (" + msg + "). Recarregue a página para tentar de novo.");
      }
    );
  }

  // ---------- tabuleiro ----------
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

  function tryMove(tilePos) {
    if (current.solving) return;
    var s = current.state;
    var z = s.indexOf("8");
    var adj = (Math.abs((tilePos % 3) - (z % 3)) +
      Math.abs(((tilePos / 3) | 0) - ((z / 3) | 0))) === 1;
    if (!adj) return;
    var a = s.split("");
    a[z] = a[tilePos]; a[tilePos] = "8";
    setState(a.join(""));
  }

  function setState(str) {
    current.state = str;
    current.idx = idxOf.get(encode(str));
    afterStateChange();
  }

  // ---------- busca + recolorir ----------
  var runToken = 0;
  function afterStateChange() {
    renderBoard();

    if (current.state === GOAL_STR) {
      current.path = null;
      current.hintIndex = -1;
      runToken++;
      graph.setExplored([GOAL_IDX], 1);
      graph.setPath([GOAL_IDX]);
      graph.setCurrent(GOAL_IDX);
      graph.setSuggested(-1);
      setStatus('<span class="tag">resolvido</span> <b>Montou! ✧ · ♡ · ✧</b> ' +
        "Embaralhe de novo ou troque a imagem.");
      if (typeof celebrate === "function") celebrate("win");
      return;
    }

    setStatus('<span class="tag">bfs</span> Rodando a busca sobre o grafo fixo…');
    searchAndReveal(current.idx, onSearched);
  }

  function searchAndReveal(startIdx, onDone) {
    var token = ++runToken;
    var res = bfsFrom(startIdx);

    graph.setCurrent(startIdx);
    graph.setPath(null);
    graph.setSuggested(-1);

    // revela a região visitada crescendo, sobre o MESMO grafo
    var shown = bfsQueue;           // já está na ordem de visita
    var total = res.visited;
    var i = 0;
    var budget = Math.max(8, Math.ceil(total / 55));

    function step() {
      if (token !== runToken) return;
      i = Math.min(total, i + budget);
      graph.setExplored(shown, i);
      if (i < total) {
        setTimeout(step, 16);
      } else {
        if (res.path) {
          graph.setPath(res.path);
          if (showHint) graph.setSuggested(res.path.length > 1 ? res.path[1] : -1);
        }
        onDone(res.path);
      }
    }
    step();
  }

  function onSearched(path) {
    if (!path) { setStatus("Sem solução encontrada."); return; }
    current.path = path;
    var moves = path.length - 1;
    var nextStr = decode(stateOf[path[1]]);
    current.hintIndex = nextStr.indexOf("8");
    renderBoard();
    var tail = showHint
      ? "Peça sugerida em destaque — clique nela ou use “aplicar sugestão”."
      : "Sugestão oculta (use “mostrar sugestão” quando quiser).";
    setStatus('<span class="tag">bfs</span> Caminho mínimo: <b>' + moves +
      (moves === 1 ? " movimento" : " movimentos") + "</b>. " + tail);
  }

  // ---------- controles ----------
  function doShuffle() {
    if (current.solving) return;
    current.hintIndex = -1;
    setState(scramble(+depthInput.value));
  }

  function applyHint() {
    if (current.solving || !current.path || current.path.length < 2) return;
    setState(decode(stateOf[current.path[1]]));
  }

  function solveAll() {
    if (current.solving || !current.path || current.path.length < 2) return;
    current.solving = true;
    setControls(true);

    function stepAlong() {
      if (!current.solving) { setControls(false); return; }
      if (current.state === GOAL_STR) {
        current.solving = false;
        setControls(false);
        afterStateChange();
        return;
      }
      searchAndReveal(current.idx, function (path) {
        if (!path || path.length < 2) {
          current.solving = false;
          setControls(false);
          onSearched(path);
          return;
        }
        current.path = path;
        var nextStr = decode(stateOf[path[1]]);
        current.hintIndex = nextStr.indexOf("8");
        current.state = nextStr;
        current.idx = path[1];
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
    btnHint.disabled = lock || !showHint;
    btnHintToggle.disabled = lock;
    btnChange.disabled = lock;
    depthInput.disabled = lock;
    btnSolve.textContent = (lock && current.solving) ? "parar" : "resolver";
    btnSolve.disabled = lock && !current.solving;
  }

  depthInput.addEventListener("input", function () {
    depthVal.textContent = depthInput.value;
  });
  btnShuffle.addEventListener("click", doShuffle);
  btnHint.addEventListener("click", applyHint);
  btnHintToggle.addEventListener("click", function () {
    showHint = !showHint;
    btnHintToggle.textContent = showHint ? "ocultar sugestão" : "mostrar sugestão";
    btnHint.disabled = !showHint;
    if (current.path && current.path.length > 1) {
      var nextStr = decode(stateOf[current.path[1]]);
      current.hintIndex = showHint ? nextStr.indexOf("8") : -1;
      graph.setSuggested(showHint ? current.path[1] : -1);
      onSearched(current.path);
    } else {
      current.hintIndex = -1;
      renderBoard();
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

  // atalho: #kuromi na URL já abre aquela imagem
  var hash = (location.hash || "").replace("#", "").toLowerCase();
  if (hash) {
    for (var i = 0; i < CHARACTERS.length; i++) {
      var slug = CHARACTERS[i].file.replace(/^list-/, "").replace(/(-1)?\.png$/, "");
      if (slug === hash) { chooseCharacter(CHARACTERS[i], gridEl.children[i]); break; }
    }
  }
})();
