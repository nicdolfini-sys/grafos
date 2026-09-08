/* ============================================================
   Eight Puzzle (3x3) — BFS sobre o grafo de estados
   Segue o pseudocodigo dado:

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

   Estado = string de 9 digitos '0'..'8', onde '8' e o espaco vazio.
   Objetivo = "012345678". Vizinho = deslizar uma peca para o vazio.
   O grafo ao lado e desenhado enquanto a BFS expande (tempo real).
   ============================================================ */
(function () {
  "use strict";

  var GOAL = "012345678";
  var MAX_NODES = 250000;

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

  // ---------- grafo do puzzle ----------
  function neighbors(s) {
    var z = s.indexOf("8");
    var r = (z / 3) | 0, c = z % 3;
    var out = [];
    var cand = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    for (var i = 0; i < 4; i++) {
      var nr = cand[i][0], nc = cand[i][1];
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      var nz = nr * 3 + nc;
      var a = s.split("");
      var t = a[z]; a[z] = a[nz]; a[nz] = t;
      out.push(a.join(""));
    }
    return out;
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
    if (s === GOAL) return scramble(depth); // tenta de novo se caiu no objetivo
    return s;
  }

  // ---------- BFS animada, transmitindo nos para o grafo ----------
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");
  var runToken = 0;

  function solveAnimated(start, onDone) {
    var token = ++runToken;
    graph.clear();

    var queue = [start];
    var head = 0;
    var parent = new Map([[start, null]]);
    var depth = new Map([[start, 0]]);
    graph.addNode(start, 0, "start");

    function frame() {
      if (token !== runToken) return;
      var budget = 900, n = 0;
      while (head < queue.length && n < budget) {
        var state = queue[head++];
        if (state === GOAL) {
          finalize(reconstruct(parent, state), null);
          return;
        }
        var nb = neighbors(state);
        for (var i = 0; i < nb.length; i++) {
          var nxt = nb[i];
          if (!parent.has(nxt)) {
            parent.set(nxt, state);
            var d = depth.get(state) + 1;
            depth.set(nxt, d);
            queue.push(nxt);
            graph.addNode(nxt, d, nxt === GOAL ? "goal" : "seen");
            graph.addEdge(state, nxt);
          }
        }
        n++;
        if (parent.size > MAX_NODES) {
          finalize(null, "cap");
          return;
        }
      }
      updateCount(parent.size);
      if (graph.autoFit) graph.fit(); else graph.requestDraw();

      if (head < queue.length) {
        setTimeout(frame, 16);
      } else {
        finalize(null, "empty");
      }
    }

    function finalize(path, reason) {
      if (token !== runToken) return;
      updateCount(parent.size);
      if (path) {
        graph.setPath(path);
        graph.setCurrent(path[0]);
        graph.setSuggested(path.length > 1 ? path[1] : null);
        if (graph.autoFit) graph.fit(); else graph.requestDraw();
      }
      onDone(path, reason);
    }

    setTimeout(frame, 0);
  }

  function updateCount(nodes) {
    var c = graph.count();
    countEl.textContent = c.nodes + " nós · " + c.edges + " arestas";
  }

  // ---------- estado / DOM ----------
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
  var btnSolve = document.getElementById("btn-solve");
  var btnChange = document.getElementById("btn-change");

  var current = { char: null, state: GOAL, path: null, hintIndex: -1, solving: false };

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
    gameEl.classList.remove("hidden");
    gameEl.scrollIntoView({ behavior: "smooth", block: "start" });
    doShuffle();
  }

  function setStatus(html) { statusEl.innerHTML = html; }

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
      } else {
        var col = (+v) % 3, row = ((+v) / 3) | 0;
        tile.style.backgroundImage = url;
        tile.style.backgroundPosition = (col * 50) + "% " + (row * 50) + "%";
      }
      if (i === current.hintIndex && v !== "8") tile.classList.add("-hint");
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
    var a = s.split("");
    a[z] = a[idx]; a[idx] = "8";
    current.state = a.join("");
    afterStateChange();
  }

  function afterStateChange() {
    renderBoard();
    if (current.state === GOAL) {
      current.path = [GOAL];
      current.hintIndex = -1;
      runToken++;                 // cancela BFS pendente
      graph.clear();
      graph.addNode(GOAL, 0, "goal");
      graph.setPath([GOAL]);
      graph.fit();
      updateCount(1);
      setStatus('<span class="tag">resolvido</span> <b>Montou! ✧ · ♡ · ✧</b> ' +
        "Embaralhe de novo ou troque a imagem.");
      return;
    }
    setStatus('<span class="tag">bfs</span> Expandindo o grafo de estados…');
    solveAnimated(current.state, onSolved);
  }

  function onSolved(path, reason) {
    if (reason === "cap") {
      current.path = null;
      current.hintIndex = -1;
      renderBoard();
      setStatus('<span class="tag">bfs</span> Espaço de busca grande demais ' +
        "(" + MAX_NODES.toLocaleString("pt-BR") + "+ nós). Diminua o " +
        "embaralhamento e tente de novo.");
      return;
    }
    if (!path) { setStatus("Sem solução encontrada."); return; }
    current.path = path;
    var moves = path.length - 1;
    current.hintIndex = path[1].indexOf("8"); // peça que deve deslizar
    renderBoard();
    setStatus('<span class="tag">bfs</span> Caminho mínimo: <b>' + moves +
      (moves === 1 ? " movimento" : " movimentos") + "</b>. " +
      "Peça sugerida em destaque — clique nela ou use “aplicar sugestão”.");
  }

  function doShuffle() {
    if (current.solving) return;
    var d = +depthInput.value;
    current.state = scramble(d);
    current.hintIndex = -1;
    afterStateChange();
  }

  function applyHint() {
    if (current.solving || !current.path || current.path.length < 2) return;
    current.state = current.path[1];
    afterStateChange();
  }

  function solveAll() {
    if (current.solving) return;
    if (!current.path || current.path.length < 2) return;
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
      // BFS a cada passo -> o grafo encolhe conforme chega no objetivo
      solveAnimated(current.state, function (path, reason) {
        if (reason === "cap" || !path || path.length < 2) {
          current.solving = false;
          setControls(false);
          onSolved(path, reason);
          return;
        }
        current.path = path;
        current.hintIndex = path[1].indexOf("8");
        current.state = path[1];
        renderBoard();
        var left = path.length - 2;
        setStatus('<span class="tag">resolvendo</span> ' + left +
          " movimento(s) restante(s)…");
        setTimeout(stepAlong, 480);
      });
    }
    stepAlong();
  }

  function setControls(lock) {
    btnShuffle.disabled = lock;
    btnHint.disabled = lock;
    btnChange.disabled = lock;
    depthInput.disabled = lock;
    btnSolve.textContent = lock ? "parar" : "resolver";
  }

  // ---------- eventos ----------
  depthInput.addEventListener("input", function () {
    depthVal.textContent = depthInput.value;
  });
  btnShuffle.addEventListener("click", doShuffle);
  btnHint.addEventListener("click", applyHint);
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

  // atalho: #hellokitty na URL ja abre aquela imagem
  var hash = (location.hash || "").replace("#", "").toLowerCase();
  if (hash) {
    for (var i = 0; i < CHARACTERS.length; i++) {
      var slug = CHARACTERS[i].file.replace(/^list-/, "").replace(/(-1)?\.png$/, "");
      if (slug === hash) { chooseCharacter(CHARACTERS[i], gridEl.children[i]); break; }
    }
  }
})();
