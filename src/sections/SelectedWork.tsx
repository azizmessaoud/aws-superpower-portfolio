import Icon from "../ui/Icon";
import { CASES } from "./projects/summary";
import CompareBars from "./projects/CompareBars";
import MiniViz from "./projects/MiniViz";

/* Directly under the hero: the three flagship projects as cards. Each card is one figure, its caption and a short caveat,
 * so a reviewer sees the result and where it stops without reading a paragraph. The full text is in the case study (#projects).
 * The whole card is a link to that case study (the "Read the case study" link stretches over it); the proof link sits above. */
export default function SelectedWork() {
  return (
    <section id="selected" className="selected" aria-labelledby="selected-title">
      <div className="inner">
        <h2 id="selected-title" className="selected-h2">Selected work</h2>
        <ul className="selected-grid">
          {CASES.map((c) => (
            <li key={c.id} className="selected-card spot">
              <p className="selected-kind">{c.kind}</p>
              <h3 className="selected-title">{c.title}</h3>
              <p className="selected-result">
                <span className="selected-figure">{c.figure.value}</span>
                <span className="selected-figcap">{c.figure.caption}</span>
              </p>
              <div className="selected-compare">{c.compare ? <CompareBars c={c.compare} /> : <MiniViz id={c.id} />}</div>
              <p className="selected-caveat"><Icon name="alert" /><span><strong>Caveat:</strong> {c.caveatShort}</span></p>
              {c.myPart && <p className="selected-part"><strong>My part:</strong> {c.myPart}</p>}
              <div className="selected-links">
                <a className="selected-open" href={`#project-${c.id}`}>Read the case study <Icon name="arrow" /></a>
                <a className="selected-proof" href={c.proof.url}>{c.proof.label} <Icon name="external" /><span className="sr-only"> (opens GitHub)</span></a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
