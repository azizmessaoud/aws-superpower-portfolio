/* Runs before first paint: reserve the pinned-hero runway (no layout shift) and arm the one-time intro.
 * Kept as a same-origin file so the CSP needs no 'unsafe-inline'. */
(function () {
  var d = document.documentElement, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  d.classList.add("js");
  if (!still && scrollY < 10) {
    d.classList.add("intro");
    setTimeout(function () { d.classList.remove("intro"); }, 1500);
  }
})();
