/* ============================================================
   Jogo da Velha — DFS sobre UM grafo estático de estados

   - O grafo completo (todos os 5478 tabuleiros alcançáveis a partir do
     vazio) é construído UMA vez e nunca mais muda.
   - A cada jogada, a busca é apenas RECOLORIDA sobre esse mesmo grafo:
       • região ainda alcançável a partir da posição atual  -> "explorado"
         (é tudo que o minimax/DFS percorre para avaliar a jogada)
       • linha principal (variação ótima a partir da sua sugestão) -> caminho
   - Sugestão para você (X): minimax por DFS recursivo memoizado
       valor = +1 se X vence, -1 se O vence, 0 empate; X maximiza, O minimiza.
   - Computador (O): joga qualquer casa "segura" (que não te dê vitória na
     resposta); se todas te derem vitória, é inevitável; vence se puder.
   ============================================================ */
(function () {
  "use strict";

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function winner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return b[L[0]];
    }
    return null;
  }
  function winningLine(b) {
    for (var i = 0; i < LINES.length; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return L;
    }
    return null;
  }
  function isFull(b) {
    for (var i = 0; i < 9; i++) if (!b[i]) return false;
    return true;
  }
  function empties(b) {
    var out = [];
    for (var i = 0; i < 9; i++) if (!b[i]) out.push(i);
    return out;
  }
  function plies(b) {
    var n = 0;
    for (var i = 0; i < 9; i++) if (b[i]) n++;
    return n;
  }
  function other(p) { return p === "X" ? "O" : "X"; }
  function idOf(b) {
    var s = "";
    for (var i = 0; i < 9; i++) s += b[i] || "-";
    return s;
  }
  function boardFromId(id) {
    var b = [];
    for (var i = 0; i < 9; i++) b.push(id[i] === "-" ? "" : id[i]);
    return b;
  }
  function turnOf(b) { return plies(b) % 2 === 0 ? "X" : "O"; }

  // ---------- minimax por DFS (memoizado) ----------
  var memo = Object.create(null);
  function value(b, player) {
    var key = idOf(b) + player;
    if (key in memo) return memo[key];
    var w = winner(b), sc;
    if (w === "X") sc = 1;
    else if (w === "O") sc = -1;
    else if (isFull(b)) sc = 0;
    else {
      var es = empties(b);
      var best = player === "X" ? -Infinity : Infinity;
      for (var i = 0; i < es.length; i++) {
        var nb = b.slice();
        nb[es[i]] = player;
        var s = value(nb, other(player));
        best = player === "X" ? Math.max(best, s) : Math.min(best, s);
      }
      sc = best;
    }
    memo[key] = sc;
    return sc;
  }

  function suggestForX(b) {
    var es = empties(b), best = null, bestScore = -Infinity;
    for (var i = 0; i < es.length; i++) {
      var nb = b.slice();
      nb[es[i]] = "X";
      var s = value(nb, "O");
      if (s > bestScore) { bestScore = s; best = es[i]; }
    }
    return { move: best, score: bestScore };
  }

  function principalVariation(b, player) {
    var path = [idOf(b)];
    var cur = b.slice(), turn = player, guard = 0;
    while (!winner(cur) && !isFull(cur) && guard++ < 9) {
      var es = empties(cur), pick = es[0];
      var pscore = turn === "X" ? -Infinity : Infinity;
      for (var i = 0; i < es.length; i++) {
        var nb = cur.slice();
        nb[es[i]] = turn;
        var s = value(nb, other(turn));
        if (turn === "X" ? s > pscore : s < pscore) { pscore = s; pick = es[i]; }
      }
      cur[pick] = turn;
      path.push(idOf(cur));
      turn = other(turn);
    }
    return path;
  }

  // ---------- regra do computador (O) ----------
  function computerMove(b) {
    var es = empties(b), i, m;
    for (i = 0; i < es.length; i++) {
      var w = b.slice(); w[es[i]] = "O";
      if (winner(w) === "O") return es[i];
    }
    var safe = [];
    for (i = 0; i < es.length; i++) {
      m = es[i];
      var nb = b.slice(); nb[m] = "O";
      var xCanWin = false;
      var es2 = empties(nb);
      for (var j = 0; j < es2.length; j++) {
        var xb = nb.slice(); xb[es2[j]] = "X";
        if (winner(xb) === "X") { xCanWin = true; break; }
      }
      if (!xCanWin) safe.push(m);
    }
    var pool = safe.length ? safe : es;
    return pool[(Math.random() * pool.length) | 0];
  }

  // ---------- grafo estático completo (construído 1x) ----------
  var EMPTY_ID = "---------";
  var ADJ = new Map();      // id -> [idsFilhos]
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");

  function buildFullGraph() {
    var nodes = [[EMPTY_ID, 0]];
    var edges = [];
    var seen = Object.create(null);
    seen[EMPTY_ID] = true;
    var q = [EMPTY_ID], head = 0;

    while (head < q.length) {
      var id = q[head++];
      var b = boardFromId(id);
      if (winner(b) || isFull(b)) { ADJ.set(id, []); continue; }
      var player = turnOf(b);
      var es = empties(b), kids = [];
      for (var i = 0; i < es.length; i++) {
        var nb = b.slice();
        nb[es[i]] = player;
        var cid = idOf(nb);
        kids.push(cid);
        edges.push([id, cid]);
        if (!seen[cid]) {
          seen[cid] = true;
          nodes.push([cid, plies(nb)]);
          q.push(cid);
        }
      }
      ADJ.set(id, kids);
    }
    graph.setGraph(nodes, edges);
    var c = graph.count();
    countEl.textContent = c.nodes + " nós · " + c.edges + " arestas (grafo fixo)";
  }

  // região ainda alcançável a partir de `curId` (o que a DFS percorre)
  function reachableFrom(curId) {
    var set = new Set([curId]);
    var order = [curId], h = 0;
    while (h < order.length) {
      var kids = ADJ.get(order[h++]) || [];
      for (var i = 0; i < kids.length; i++) {
        if (!set.has(kids[i])) { set.add(kids[i]); order.push(kids[i]); }
      }
    }
    return { set: set, order: order };
  }

  // ---------- animação: recolore a busca no grafo fixo ----------
  var revealToken = 0;
  function revealSearch(board, withSuggestion) {
    var token = ++revealToken;
    var curId = idOf(board);
    graph.setCurrent(curId);

    var r = reachableFrom(curId);
    var pv = principalVariation(board, turnOf(board));

    var shown = new Set();
    var i = 0;
    var budget = Math.max(6, Math.ceil(r.order.length / 55));

    function step() {
      if (token !== revealToken) return;
      var n = 0;
      while (i < r.order.length && n < budget) { shown.add(r.order[i++]); n++; }
      graph.setExplored(shown);
      if (i < r.order.length) {
        setTimeout(step, 16);
      } else {
        graph.setPath(pv);
        graph.setSuggested(withSuggestion && pv.length > 1 ? pv[1] : null);
      }
    }
    step();
  }

  // ---------- estado da partida ----------
  var board, gameOver, hintOn;
  var boardEl = document.getElementById("board");
  var statusEl = document.getElementById("status");
  var btnNew = document.getElementById("btn-new");
  var btnHint = document.getElementById("btn-hint");

  function setStatus(html) { statusEl.innerHTML = html; }

  function newGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    gameOver = false;
    hintOn = true;
    draw();
    revealSearch(board, true);
    setStatus('<span class="tag">sua vez</span> Você é o <b>X</b>. ' +
      "A casa destacada é a sugestão do minimax.");
  }

  function draw() {
    var sug = (!gameOver && hintOn && empties(board).length > 0)
      ? suggestForX(board).move : -1;
    var wl = winningLine(board);
    boardEl.innerHTML = "";
    for (var i = 0; i < 9; i++) {
      var cell = document.createElement("button");
      cell.className = "ttt-cell";
      if (!board[i]) cell.classList.add("-empty");
      if (board[i] === "X") cell.classList.add("-x");
      if (board[i] === "O") cell.classList.add("-o");
      if (i === sug) cell.classList.add("-hint");
      if (wl && wl.indexOf(i) !== -1) cell.classList.add("-win");
      cell.textContent = board[i] === "X" ? "✕" : (board[i] === "O" ? "◯" : "");
      cell.disabled = gameOver || !!board[i];
      (function (idx) {
        cell.addEventListener("click", function () { playerMove(idx); });
      })(i);
      boardEl.appendChild(cell);
    }
  }

  function playerMove(idx) {
    if (gameOver || board[idx]) return;
    board[idx] = "X";
    draw();

    if (winner(board) === "X") { finish("Você venceu! ✧", true); return; }
    if (isFull(board)) { finish("Deu velha. ▽", false); return; }

    setStatus('<span class="tag">vez do O</span> O computador está escolhendo…');
    graph.setCurrent(idOf(board));
    graph.setPath([]);
    graph.setSuggested(null);

    setTimeout(function () {
      var m = computerMove(board);
      board[m] = "O";
      draw();

      if (winner(board) === "O") { finish("O computador venceu. ◯", false); return; }
      if (isFull(board)) { finish("Deu velha. ▽", false); return; }

      var sug = suggestForX(board);
      revealSearch(board, true);
      var msg = sug.score > 0 ? "há jogada vencedora para você"
        : (sug.score === 0 ? "melhor caso: empate" : "você está em desvantagem, jogue pra segurar");
      setStatus('<span class="tag">sua vez</span> Sugestão: casa destacada — <b>' +
        msg + "</b>.");
    }, 480);
  }

  function finish(msg, playerWon) {
    gameOver = true;
    draw();
    revealSearch(board, false);
    setStatus('<span class="tag">fim</span> <b>' + msg + "</b> Clique em “nova partida”.");
    if (playerWon && typeof celebrate === "function") celebrate("win");
  }

  btnNew.addEventListener("click", newGame);
  btnHint.addEventListener("click", function () {
    hintOn = !hintOn;
    btnHint.textContent = hintOn ? "ocultar sugestão" : "mostrar sugestão";
    draw();
  });
  document.getElementById("btn-fit").addEventListener("click", function (e) {
    e.preventDefault();
    graph.fit();
  });

  // ---------- arranque ----------
  setStatus('<span class="tag">montando</span> Construindo o grafo completo (uma vez)…');
  setTimeout(function () {
    buildFullGraph();
    newGame();
  }, 30);
})();
