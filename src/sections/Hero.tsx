import type { MindState } from "../mind/state";
import AskPanel from "./AskPanel";

interface Props { mind: MindState; setMind: (s: MindState) => void; reduced: boolean }

export default function Hero({ mind, setMind, reduced }: Props) {
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-name">Aziz Messaoud</span><span className="eyebrow-role"> · Data Science Engineering, ESPRIT</span></p>
          <h1 id="hero-title" className="hero-h1">I turn data into <span className="hl">useful work.</span></h1>
          <p className="hero-lead">
            I build and evaluate data science projects across ranking, document processing and multi-agent simulation.
            I make my contribution, the results and the limitations easy to check.
          </p>
          <p className="hero-avail"><span className="avail-dot" aria-hidden="true" />Open to a 2027 final-year internship (PFE) · AI/ML engineering, applied data science, AI research</p>
          <div className="hero-actions">
            <a className="btn-primary" href="#selected">View selected work</a>
            <a className="btn-ghost" href="#contact">Talk about a role</a>
          </div>
        </div>
        <figure className="hero-portrait">
          <img src="/portrait.jpg" width="480" height="480" alt="Portrait of Aziz Messaoud" fetchPriority="high" decoding="async" />
          <figcaption><span>Aziz Messaoud</span><span>Data Science Engineering · ESPRIT, Tunisia</span></figcaption>
        </figure>
        <AskPanel mind={mind} setMind={setMind} reduced={reduced} />
      </div>
    </section>
  );
}
