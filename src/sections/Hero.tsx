import { useEffect } from "react";
import { askQuestion } from "../ask";
import Icon from "../ui/Icon";

export default function Hero() {
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
        <p className="scroll-hint" aria-hidden="true">scroll <Icon name="down" /></p>
      </div>
      <div className="hero-runway" aria-hidden="true" />
    </section>
  );
}
