/* Pointer-follow glow for cards marked .spot: writes --mx / --my (px, relative to the card) on the card under the pointer, and the
 * CSS draws a soft light there. One passive listener, one write per frame, only on the card being hovered. It does nothing on touch
 * screens or with reduced motion, and the page is complete without it (the card still lifts and its border still lights). */
export function installSpotlight(): () => void {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let raf = 0, last: PointerEvent | null = null;
  const apply = () => {
    raf = 0;
    const el = (last?.target as Element | null)?.closest?.<HTMLElement>(".spot");
    if (!el || !last) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${Math.round(last.clientX - r.left)}px`);
    el.style.setProperty("--my", `${Math.round(last.clientY - r.top)}px`);
  };
  const move = (e: PointerEvent) => { last = e; if (!raf) raf = requestAnimationFrame(apply); };
  document.addEventListener("pointermove", move, { passive: true });
  return () => { document.removeEventListener("pointermove", move); if (raf) cancelAnimationFrame(raf); };
}
