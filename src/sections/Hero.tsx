import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { askQuestion } from "../ask";
import Icon from "../ui/Icon";

const NeuralScene = lazy(() => import("../scene/NeuralScene"));

function readPaused() {
  try { return localStorage.getItem("motion") === "paused"; } catch { return false; }
}

export default function Hero() {
  const hero = useRef<HTMLElement>(null);
  const runway = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [paused, setPaused] = useState(readPaused);

  /* Start the one-time text reveal as soon as the hero is on screen (the head script's timer is only a fallback). */
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.remove("intro"));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* Only the visitor's own press changes this; nothing resumes on its own. */
  const togglePaused = () => setPaused((p) => {
    try { localStorage.setItem("motion", p ? "playing" : "paused"); } catch { /* storage blocked: session-only choice */ }
    return !p;
  });

  return (
    <section id="top" ref={hero} className="hero" aria-labelledby="hero-title">
      <div className="hero-stage">
        <Suspense fallback={null}>
          <NeuralScene hero={hero} runway={runway} text={inner} paused={paused} reduced={reduced} />
        </Suspense>
        <div className="hero-inner" ref={inner}>
          <p className="eyebrow">Aziz Messaoud · Data Science Engineering, ESPRIT</p>
          <h1 id="hero-title" className="hero-h1">
            Ask my brain <span className="grad-text">what I've built.</span>
          </h1>
          <p className="hero-lead">
            I work across applied machine learning, document AI, ranking and multi-agent simulation.
            Every answer here links to the repository, report or notebook it came from, including what didn't work.
          </p>
          <div className="ctas">
            <a className="btn-primary" href="#ask">Ask my brain <Icon name="arrow" /></a>
            <a className="btn-ghost" href="#projects">See the projects</a>
          </div>
          <p className="hint">
            <span className="hint-label">Try</span>
            <button type="button" className="hint-q" onClick={() => askQuestion("Are ambulances faster with TraffiX?")}>
              “Are ambulances faster with TraffiX?”
            </button>
          </p>
        </div>
        {!reduced && (
          <button className="motion-toggle" type="button" aria-pressed={paused} onClick={togglePaused}>
            <Icon name={paused ? "play" : "pause"} />
            <span>{paused ? "Play motion" : "Pause motion"}</span>
          </button>
        )}
        <p className="scroll-hint" aria-hidden="true">scroll <Icon name="down" /></p>
      </div>
      <div className="hero-runway" ref={runway} aria-hidden="true" />
    </section>
  );
}
