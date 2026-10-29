import { useEffect } from "react";
import type { MindState } from "../mind/state";
import AskPanel from "./AskPanel";

interface Props { mind: MindState; setMind: (s: MindState) => void; reduced: boolean; onLayout: () => void }

export default function Hero({ mind, setMind, reduced, onLayout }: Props) {
  /* Start the one-time text reveal as soon as the hero is on screen (boot.js's timer is only a fallback). */
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.remove("intro"));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-inner">
          <p className="eyebrow">Aziz Messaoud · Data Science Engineering, ESPRIT</p>
          <h1 id="hero-title" className="hero-h1">I build <span className="hl">practical AI systems.</span></h1>
          <p className="hero-lead">
            Applied ML, document AI, ranking and multi-agent simulation. Every project links to its repo, report or
            notebook, including what didn't work. Below, you can check any of it against the evidence.
          </p>
          <AskPanel mind={mind} setMind={setMind} reduced={reduced} onLayout={onLayout} />
        </div>
      </div>
      <div className="hero-runway" aria-hidden="true" />
    </section>
  );
}
