/* Preenche as bordas onduladas ﹌ e alguns enfeites da estetica. */
(function () {
  "use strict";
  document.querySelectorAll("[data-wave]").forEach(function (el) {
    el.textContent = "﹌".repeat(320); // ﹌
  });
  document.querySelectorAll("[data-wave-inline]").forEach(function (el) {
    var n = parseInt(el.getAttribute("data-wave-inline"), 10) || 12;
    el.textContent = "﹌".repeat(n);
  });
})();
