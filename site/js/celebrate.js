/* ============================================================
   celebrate() — confete em tons pastéis + brilhos tipo fogos de
   artifício + a palavra "win" no mesmo estilo do "welcome" da home.
   Sem bibliotecas. Chamada quando o jogador vence.
   ============================================================ */
(function (global) {
  "use strict";

  var PASTELS = [
    "#ffc0fb", "#ffe4a1", "#c7f0d8", "#cfe4ff",
    "#e8d5ff", "#ffd6e8", "#fff6c9", "#ffffff"
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function celebrate(word) {
    word = word || "win";

    var canvas = document.createElement("canvas");
    canvas.className = "fx-canvas";
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var dpr = global.devicePixelRatio || 1;

    function size() {
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    global.addEventListener("resize", size);

    // ---- palavra "win" ----
    var mark = document.createElement("div");
    mark.className = "fx-word";
    mark.textContent = word;
    document.body.appendChild(mark);
    requestAnimationFrame(function () { mark.classList.add("-in"); });

    // ---- confete ----
    var confetti = [];
    var n = 150;
    for (var i = 0; i < n; i++) {
      confetti.push({
        x: rand(0, innerWidth),
        y: rand(-innerHeight * 0.4, 0),
        w: rand(6, 12),
        h: rand(8, 16),
        vx: rand(-0.6, 0.6),
        vy: rand(1.6, 4.2),
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.2, 0.2),
        color: PASTELS[(Math.random() * PASTELS.length) | 0]
      });
    }

    // ---- brilhos / fogos ----
    var sparks = [];
    function burst(cx, cy) {
      var c = PASTELS[(Math.random() * PASTELS.length) | 0];
      var k = 26;
      for (var i = 0; i < k; i++) {
        var ang = (Math.PI * 2 * i) / k + rand(-0.15, 0.15);
        var sp = rand(2, 6);
        sparks.push({
          x: cx, y: cy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: 1, color: c, size: rand(1.5, 3.5)
        });
      }
    }
    var burstTimes = [0, 350, 700, 1050, 1500];
    burstTimes.forEach(function (t) {
      setTimeout(function () {
        burst(rand(innerWidth * 0.2, innerWidth * 0.8), rand(innerHeight * 0.2, innerHeight * 0.55));
      }, t);
    });

    var start = performance.now();
    var DURATION = 2800;

    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, innerWidth, innerHeight);

      // confete
      for (var i = 0; i < confetti.length; i++) {
        var p = confetti[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.02; p.rot += p.vr;
        var fade = t > DURATION - 700 ? Math.max(0, (DURATION - t) / 700) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      // brilhos
      for (var j = sparks.length - 1; j >= 0; j--) {
        var s = sparks[j];
        s.x += s.vx; s.y += s.vy; s.vy += 0.04; s.vx *= 0.98; s.vy *= 0.98;
        s.life -= 0.02;
        if (s.life <= 0) { sparks.splice(j, 1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (t < DURATION || sparks.length) {
        requestAnimationFrame(frame);
      } else {
        cleanup();
      }
    }
    requestAnimationFrame(frame);

    function cleanup() {
      global.removeEventListener("resize", size);
      mark.classList.remove("-in");
      mark.classList.add("-out");
      setTimeout(function () {
        if (mark.parentNode) mark.parentNode.removeChild(mark);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }, 600);
    }
  }

  global.celebrate = celebrate;
})(window);
