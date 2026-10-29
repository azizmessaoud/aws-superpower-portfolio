import { useEffect, useRef, useState } from "react";
import type { Scene } from "../scene/scene";
import Icon from "./Icon";

const LINKS = [
  ["about", "About"],
  ["skills", "Skills"],
  ["projects", "Projects"],
  ["certifications", "Certifications"],
  ["contact", "Contact"],
] as const;

interface Props { scene: Scene | null; reduced: boolean; paused: boolean; onTogglePause: () => void; docked: boolean }

/* Move keyboard focus to where an in-page link lands, so Tab continues from there. */
function landOn(id: string) {
  const el = id === "terminal" ? document.getElementById("term-input") : document.getElementById(id);
  if (!el) return;
  if (id !== "terminal" && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  /* after the browser has followed the #fragment, which would otherwise reset focus */
  setTimeout(() => el.focus({ preventScroll: true }), 0);
}

export default function Nav({ scene, reduced, paused, onTogglePause, docked }: Props) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    /* the section crossing the middle of the viewport is "current" */
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    [...LINKS.map(([id]) => id), "terminal"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen((o) => { if (o) toggle.current?.focus(); return false; }); };
    const onDoc = (e: MouseEvent) => { if (nav.current && !nav.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDoc);
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); document.removeEventListener("keydown", onKey); document.removeEventListener("click", onDoc); };
  }, []);
  /* the scene keeps out of the open menu panel */
  useEffect(() => { const id = setTimeout(() => scene?.remeasure(), 220); return () => clearTimeout(id); }, [open, scene]);

  const wake = (on: boolean) => () => scene?.setDockActive(on);

  return (
    <nav ref={nav} className={`nav${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`} aria-label="Main">
      <a className="nav-logo" href="#top" aria-label="Aziz Messaoud, back to top">AM</a>
      <ul className="nav-links" id="nav-links">
        {LINKS.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? "true" : undefined} onClick={() => { setOpen(false); landOn(id); }}>{label}</a>
          </li>
        ))}
      </ul>
      <div className="nav-end">
        {!reduced && (
          /* the label states the action; no aria-pressed, so assistive tech never hears two conflicting states */
          <button className={`motion-toggle${paused ? " is-paused" : ""}`} type="button" onClick={onTogglePause}>
            <Icon name={paused ? "play" : "pause"} />
            <span className="motion-label">{paused ? "Play motion" : "Pause motion"}</span>
          </button>
        )}
        {/* The brain docks here at the end of the hero; the link is the hint to the creative feature on every screen. */}
        <a className={`nav-cta${docked ? " is-docked" : ""}`} href="#terminal" aria-current={current === "terminal" ? "true" : undefined} onClick={() => { setOpen(false); landOn("terminal"); }}
          onMouseEnter={wake(true)} onMouseLeave={wake(false)} onFocus={wake(true)} onBlur={wake(false)}>
          <span className="dock-brain" aria-hidden="true" />
          <span className="cta-label">Ask my brain</span>
        </a>
        <button ref={toggle} className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-links"
          aria-label={open ? "Close menu" : "Menu"} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </nav>
  );
}
