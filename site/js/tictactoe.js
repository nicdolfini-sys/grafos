/* ============================================================
   Jogo da Velha — DFS sobre UM grafo estático de estados

   - O grafo completo (os 5478 tabuleiros alcançáveis a partir do vazio) é
     construído UMA vez e nunca mais muda.
   - A cada jogada só RECOLORIMOS a busca sobre esse mesmo grafo:
       • região ainda alcançável a partir da posição atual -> "explorado"
         (é exatamente o que o minimax/DFS percorre para avaliar)
       • linha principal a partir da sua sugestão -> caminho
   - Sugestão para você (X): minimax por DFS recursivo memoizado.
   - Computador (O): joga qualquer casa "segura" (que não te dê vitória na
     resposta); se todas derem, é inevitável; vence na hora se puder.
   ============================================================ */
(function () {
  "use strict";

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function winner(b) {
    for (var i = 0; i < 8; i++) {
      var L = LINES[i];
      if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[0]] === b[L[2]]) return b[L[0]];
    }
    return null;
  }
  function winningLine(b) {
    for (var i = 0; i < 8; i++) {
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
  function turnOf(b) { return plies(b) % 2 === 0 ? "X" : "O"; }
  function other(p) { return p === "X" ? "O" : "X"; }

  // tabuleiro <-> inteiro (9 dígitos base 3: 0 vazio, 1 X, 2 O)
  function encodeBoard(b) {
    var v = 0;
    for (var i = 0; i < 9; i++) v = v * 3 + (b[i] === "X" ? 1 : (b[i] === "O" ? 2 : 0));
    return v;
  }
  function decodeBoard(v) {
    var a = new Array(9);
    for (var i = 8; i >= 0; i--) {
      var c = v % 3;
      a[i] = c === 1 ? "X" : (c === 2 ? "O" : "");
      v = (v / 3) | 0;
    }
    return a;
  }

  // ---------- minimax por DFS (memoizado) ----------
  var memo = new Map();
  function valueOf(code) {
    var hit = memo.get(code);
    if (hit !== undefined) return hit;
    var b = decodeBoard(code);
    var w = winner(b), sc;
    if (w === "X") sc = 1;
    else if (w === "O") sc = -1;
    else if (isFull(b)) sc = 0;
    else {
      var player = turnOf(b);
      var es = empties(b);
      var best = player === "X" ? -Infinity : Infinity;
      for (var i = 0; i < es.length; i++) {
        var nb = b.slice();
        nb[es[i]] = player;
        var s = valueOf(encodeBoard(nb));
        best = player === "X" ? Math.max(best, s) : Math.min(best, s);
      }
      sc = best;
    }
    memo.set(code, sc);
    return sc;
  }

  function suggestForX(b) {
    var es = empties(b), best = -1, bestScore = -Infinity;
    for (var i = 0; i < es.length; i++) {
      var nb = b.slice();
      nb[es[i]] = "X";
      var s = valueOf(encodeBoard(nb));
      if (s > bestScore) { bestScore = s; best = es[i]; }
    }
    return { move: best, score: bestScore };
  }

  // linha principal (sequência de códigos de tabuleiro)
  function principalVariation(b) {
    var seq = [encodeBoard(b)];
    var cur = b.slice(), guard = 0;
    while (!winner(cur) && !isFull(cur) && guard++ < 9) {
      var turn = turnOf(cur);
      var es = empties(cur), pick = es[0];
      var pscore = turn === "X" ? -Infinity : Infinity;
      for (var i = 0; i < es.length; i++) {
        var nb = cur.slice();
        nb[es[i]] = turn;
        var s = valueOf(encodeBoard(nb));
        if (turn === "X" ? s > pscore : s < pscore) { pscore = s; pick = es[i]; }
      }
      cur[pick] = turn;
      seq.push(encodeBoard(cur));
    }
    return seq;
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

  // ---------- grafo estático completo ----------
  var graph = new GraphView(document.getElementById("graph"));
  var countEl = document.getElementById("graph-count");

  var idxOf = new Map();      // códigoTabuleiro -> índice
  var stateOf = [];           // índice -> códigoTabuleiro
  var childStart = [];        // CSR
  var childList = [];
  var nNodes = 0;

  function buildFullGraph(onDone) {
    var empty = ["", "", "", "", "", "", "", "", ""];
    var code0 = encodeBoard(empty);
    idxOf.set(code0, 0);
    stateOf.push(code0);
    var depths = [0];
    var edges = [];
    var head = 0;

    while (head < stateOf.length) {
      var i = head++;
      var b = decodeBoard(stateOf[i]);
      childStart[i] = childList.length;
      if (!winner(b) && !isFull(b)) {
        var player = turnOf(b);
        var es = empties(b);
        for (var k = 0; k < es.length; k++) {
          var nb = b.slice();
          nb[es[k]] = player;
          var code = encodeBoard(nb);
          var j = idxOf.get(code);
          if (j === undefined) {
            j = stateOf.length;
            idxOf.set(code, j);
            stateOf.push(code);
            depths.push(plies(nb));
          }
          childList.push(j);
          edges.push(i, j);
        }
      }
    }
    childStart.push(childList.length);
    nNodes = stateOf.length;

    graph.setGraph(
      { depths: Uint8Array.from(depths), edges: Int32Array.from(edges) },
      null,
      function () {
        var c = graph.count();
        countEl.textContent = c.nodes + " nós · " + c.edges + " arestas (grafo fixo)";
        onDone();
      }
    );
  }

  // região ainda alcançável a partir do índice atual
  var reachSeen = null;
  var reachList = null;
  function reachableFrom(start) {
    if (!reachSeen) {
      reachSeen = new Uint8Array(nNodes);
      reachList = new Int32Array(nNodes);
    }
    reachSeen.fill(0);
    var head = 0, tail = 0;
    reachList[tail++] = start;
    reachSeen[start] = 1;
    while (head < tail) {
      var u = reachList[head++];
      for (var p = childStart[u], q = childStart[u + 1]; p < q; p++) {
        var w = childList[p];
        if (!reachSeen[w]) { reachSeen[w] = 1; reachList[tail++] = w; }
      }
    }
    return tail;
  }

  // ---------- animação: recolore a busca no grafo fixo ----------
  var revealToken = 0;
  function revealSearch(board, withSuggestion) {
    var token = ++revealToken;
    var curIdx = idxOf.get(encodeBoard(board));
    graph.setCurrent(curIdx === undefined ? -1 : curIdx);

    var total = reachableFrom(curIdx);
    var pvCodes = principalVariation(board);
    var pvIdx = [];
    for (var i = 0; i < pvCodes.length; i++) {
      var j = idxOf.get(pvCodes[i]);
      if (j !== undefined) pvIdx.push(j);
    }

    graph.setPath(null);
    graph.setSuggested(-1);

    var shown = 0;
    var budget = Math.max(8, Math.ceil(total / 45));
    function step() {
      if (token !== revealToken) return;
      shown = Math.min(total, shown + budget);
      graph.setExplored(reachList, shown);
      if (shown < total) {
        setTimeout(step, 16);
      } else {
        graph.setPath(pvIdx);
        graph.setSuggested(withSuggestion && pvIdx.length > 1 ? pvIdx[1] : -1);
      }
    }
    step();
  }

  // ---------- partida ----------
  var board, gameOver, hintOn = true;
  var boardEl = document.getElementById("board");
  var statusEl = document.getElementById("status");
  var btnNew = document.getElementById("btn-new");
  var btnHint = document.getElementById("btn-hint");

  function setStatus(html) { statusEl.innerHTML = html; }

  function newGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    gameOver = false;
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
    var curIdx = idxOf.get(encodeBoard(board));
    graph.setCurrent(curIdx === undefined ? -1 : curIdx);
    graph.setPath(null);
    graph.setSuggested(-1);

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
    if (!gameOver) revealSearch(board, hintOn);
  });
  document.getElementById("btn-fit").addEventListener("click", function (e) {
    e.preventDefault();
    graph.fit();
  });

  // ---------- arranque ----------
  setStatus('<span class="tag">montando</span> Montando o grafo completo (uma vez)…');
  setTimeout(function () {
    buildFullGraph(newGame);
  }, 30);
})();
