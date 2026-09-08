/* ============================================================
   Jogo da Velha — DFS sobre a arvore de jogadas
   - minimax por DFS recursivo avalia cada estado (+1 X, -1 O, 0 empate)
   - a sugestao para o jogador (X) e a casa de maior valor
   - o computador (O) usa a regra simples pedida no enunciado
   - o grafo ao lado e a arvore explorada, com a linha principal em destaque
   ============================================================ */
(function () {
  "use strict";

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  // ---------- utilidades de tabuleiro ----------
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

  // melhor jogada para X (jogador humano)
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

  // linha principal a partir do estado (b, player) jogando otimo dos dois lados
  function principalVariation(b, player) {
    var path = [idOf(b)];
    var cur = b.slice(), turn = player;
    var guard = 0;
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

    // 1) se puder vencer agora, vence
    for (i = 0; i < es.length; i++) {
      var w = b.slice(); w[es[i]] = "O";
      if (winner(w) === "O") return es[i];
    }

    // 2) casas "seguras": depois delas, X nao vence na jogada seguinte
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

    // 3) escolhe qualquer casa segura; se nenhuma for segura, e inevitavel
    var pool = safe.length ? safe : es;
    return pool[(Math.random() * pool.length) | 0];
  }

  // ---------- construcao + animacao do grafo ----------
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");

  // Percorre por DFS o grafo (DAG) de estados alcancaveis a partir da posicao
  // atual e coleta eventos (no / aresta). A traversal e memoizada: cada estado
  // e expandido uma unica vez (senao a arvore de jogadas explodiria).
  // A profundidade de um no e o numero de pecas ja no tabuleiro (ply), o que
  // mantem toda aresta indo de uma camada para a seguinte.
  function collectTree(rootBoard, rootPlayer) {
    var events = [];
    var visited = Object.create(null);
    var rootId = idOf(rootBoard);

    function plies(b) {
      var n = 0;
      for (var i = 0; i < 9; i++) if (b[i]) n++;
      return n;
    }
    var base = plies(rootBoard);

    function dfs(b, player) {
      var id = idOf(b);
      if (visited[id]) return;
      visited[id] = true;
      var term = winner(b) || isFull(b);
      events.push({
        t: "node", id: id, depth: plies(b) - base,
        kind: id === rootId ? "start" : (term ? "goal" : "seen")
      });
      if (term) return;
      var es = empties(b);
      for (var i = 0; i < es.length; i++) {
        var nb = b.slice();
        nb[es[i]] = player;
        var cid = idOf(nb);
        events.push({ t: "edge", a: id, b: cid, cid: cid, depth: plies(nb) - base });
        dfs(nb, other(player));
      }
    }
    dfs(rootBoard.slice(), rootPlayer);
    return events;
  }

  var streamToken = 0;
  function renderGraph(board, toMove, pvPath, suggestedId) {
    graph.clear();
    var events = collectTree(board, toMove);
    var token = ++streamToken;
    var i = 0;

    function step() {
      if (token !== streamToken) return;
      var budget = 1400, n = 0;
      while (i < events.length && n < budget) {
        var e = events[i++];
        if (e.t === "node") {
          graph.addNode(e.id, e.depth, e.kind);
        } else {
          graph.addNode(e.cid, e.depth, null);
          graph.addEdge(e.a, e.b);
        }
        n++;
      }
      var c = graph.count();
      countEl.textContent = c.nodes + " nós · " + c.edges + " arestas";
      if (graph.autoFit) graph.fit();
      else graph.requestDraw();

      if (i < events.length) {
        setTimeout(step, 16);
      } else {
        graph.setPath(pvPath);
        graph.setSuggested(suggestedId);
        graph.setCurrent(idOf(board));
      }
    }
    setTimeout(step, 0);
  }

  // ---------- estado da partida ----------
  var board, gameOver, hintOn;
  var boardEl = document.getElementById("board");
  var statusEl = document.getElementById("status");
  var btnNew = document.getElementById("btn-new");
  var btnHint = document.getElementById("btn-hint");

  function newGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    gameOver = false;
    hintOn = true;
    draw();
    analyseAndRender();
    setStatus('<span class="tag">sua vez</span> Você é o <b>X</b>. ' +
      "A casa destacada é a sugestão do minimax.");
  }

  function setStatus(html) { statusEl.innerHTML = html; }

  function draw() {
    var sug = (!gameOver && hintOn && emptyCount() > 0) ? suggestForX(board).move : -1;
    var wl = winningLine(board);
    boardEl.innerHTML = "";
    for (var i = 0; i < 9; i++) {
      var cell = document.createElement("button");
      cell.className = "ttt-cell";
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

  function emptyCount() { return empties(board).length; }

  function analyseAndRender() {
    if (gameOver) {
      renderGraph(board, "X", [], null);
      return;
    }
    var sug = suggestForX(board);
    var pv = principalVariation(board, "X");
    var suggestedId = pv.length > 1 ? pv[1] : null;
    renderGraph(board, "X", pv, suggestedId);
    return sug;
  }

  function playerMove(idx) {
    if (gameOver || board[idx]) return;
    board[idx] = "X";
    draw();

    if (winner(board) === "X") { finish("Você venceu! ✧"); return; }
    if (isFull(board)) { finish("Deu velha. ▽"); return; }

    setStatus('<span class="tag">vez do O</span> O computador está escolhendo…');
    graph.setCurrent(idOf(board));

    setTimeout(function () {
      var m = computerMove(board);
      board[m] = "O";
      draw();

      if (winner(board) === "O") { finish("O computador venceu. ◯"); return; }
      if (isFull(board)) { finish("Deu velha. ▽"); return; }

      var sug = analyseAndRender();
      var msg = sug.score > 0 ? "há jogada vencedora para você"
        : (sug.score === 0 ? "melhor caso: empate" : "você está perdido, jogue pra segurar");
      setStatus('<span class="tag">sua vez</span> Sugestão: casa destacada — <b>' +
        msg + "</b>.");
    }, 480);
  }

  function finish(msg) {
    gameOver = true;
    draw();
    analyseAndRender();
    setStatus('<span class="tag">fim</span> <b>' + msg + "</b> Clique em “nova partida”.");
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

  newGame();
})();
