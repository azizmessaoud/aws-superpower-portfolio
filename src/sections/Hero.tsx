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
          <h1 id="hero-title" className="hero-h1">I build systems that can <span className="hl">show their work.</span></h1>
          <p className="hero-lead">
            Ask my brain answers questions about my projects and AWS context using verified portfolio and repository evidence.
            When the evidence is missing or says no, it says that instead.
          </p>
          <AskPanel mind={mind} setMind={setMind} reduced={reduced} onLayout={onLayout} />
        </div>
      </div>
      <div className="hero-runway" aria-hidden="true" />
    </section>
  );
}
