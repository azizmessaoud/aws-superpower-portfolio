import { useEffect, useRef, type RefObject } from "react";
import { createScene, type Scene } from "./scene";

/* Skills as listed on the live portfolio (register SK-01); no levels, no percentages. */
const SKILLS = ["Python", "SQL", "R", "scikit-learn", "PyTorch", "TensorFlow", "NLP", "LLMs",
  "Multi-agent systems", "FastAPI", "Docker", "Git", "Data visualization", "OCR / document parsing"];

interface Props {
  hero: RefObject<HTMLElement>;
  runway: RefObject<HTMLDivElement>;
  text: RefObject<HTMLDivElement>;
  paused: boolean;
  reduced: boolean;
}

export default function NeuralScene({ hero, runway, text, paused, reduced }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);

  useEffect(() => {
    if (!canvas.current || !hero.current || !runway.current) return;
    const seed = Number(new URLSearchParams(location.search).get("seed")) || 7;
    const s = createScene({
      canvas: canvas.current, hero: hero.current, runway: runway.current, labels: SKILLS, seed,
      textBlocks: () => Array.from(text.current?.children ?? []),
      avoid: () => Array.from(hero.current?.querySelectorAll(".motion-toggle, .scroll-hint") ?? []),
      reducedMotion: reduced, intro: document.documentElement.classList.contains("intro") || scrollY < 10,
    });
    scene.current = s;
    (window as unknown as { __scene?: Scene }).__scene = s;
    return () => { s.destroy(); scene.current = null; };
  }, [hero, runway, text, reduced]);

  useEffect(() => { if (paused) scene.current?.pause(); else scene.current?.resume(); }, [paused, reduced]);

  return <canvas ref={canvas} className="brain-canvas" aria-hidden="true" />;
}
