import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const LINKS = [
  ["about", "About"],
  ["skills", "Skills"],
  ["projects", "Projects"],
  ["ask", "Ask my brain"],
  ["contact", "Contact"],
] as const;

export default function Nav() {
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
    LINKS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen((o) => { if (o) toggle.current?.focus(); return false; }); } };
    const onDoc = (e: MouseEvent) => { if (nav.current && !nav.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onDoc);
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); document.removeEventListener("keydown", onKey); document.removeEventListener("click", onDoc); };
  }, []);

  return (
    <nav ref={nav} className={`nav${scrolled ? " is-scrolled" : ""}${open ? " is-open" : ""}`} aria-label="Main">
      <a className="nav-logo" href="#top" aria-label="Aziz Messaoud, back to top">AM</a>
      <ul className="nav-links" id="nav-links">
        {LINKS.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? "true" : undefined} onClick={() => setOpen(false)}>{label}</a>
          </li>
        ))}
      </ul>
      <div className="nav-end">
        <a className="nav-cta" href="#ask">Ask my brain <Icon name="arrow" /></a>
        <button ref={toggle} className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-links"
          aria-label={open ? "Close menu" : "Menu"} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
    </nav>
  );
}
