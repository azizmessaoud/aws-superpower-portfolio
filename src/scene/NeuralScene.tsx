import { useEffect, useRef } from "react";
import { createScene, type Scene } from "./scene";

/* Skills as listed on the live portfolio (register SK-01); no levels, no percentages. */
const SKILLS = ["Python", "SQL", "R", "scikit-learn", "PyTorch", "TensorFlow", "NLP", "LLMs",
  "Multi-agent systems", "FastAPI", "Docker", "Git", "Data visualization", "OCR / document parsing"];

interface Props { reduced: boolean; onReady: (s: Scene | null) => void; onDocked: (d: boolean) => void }

/* One fixed, decorative canvas for the whole page. Everything it shows is also in the page text. */
export default function NeuralScene({ reduced, onReady, onDocked }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const hero = document.getElementById("top"), stage = hero?.querySelector<HTMLElement>(".hero-stage"), runway = hero?.querySelector<HTMLElement>(".hero-runway");
    if (!canvas.current || !hero || !stage || !runway) return;
    const seed = Number(new URLSearchParams(location.search).get("seed")) || 7;
    const s = createScene({
      canvas: canvas.current, hero, stage, runway, labels: SKILLS, seed, reducedMotion: reduced,
      intro: document.documentElement.classList.contains("intro") || scrollY < 10,
      textBlocks: () => Array.from(hero.querySelectorAll(".hero-inner > *")),
      /* everything in the fixed nav except the brain's own slot, plus the scroll hint */
      fixedAvoid: () => Array.from(document.querySelectorAll(".nav-logo, .nav-links a, .cta-label, .nav-toggle, .nav.is-open .nav-links, .scroll-hint"))
        .filter((el) => getComputedStyle(el).visibility !== "hidden"),
      dockSlot: () => document.querySelector(".nav-cta .dock-brain"),
      onDocked,
    });
    (window as unknown as { __scene?: Scene }).__scene = s;
    onReady(s);
    return () => { s.destroy(); onReady(null); };
  }, [reduced, onReady, onDocked]);
  return <canvas ref={canvas} className="brain-canvas" aria-hidden="true" />;
}
