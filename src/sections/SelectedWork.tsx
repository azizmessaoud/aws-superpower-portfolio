import Icon from "../ui/Icon";
import { CASES } from "./projects/summary";

/* Directly under the hero: the three flagship projects, each with its result and its caveat side by side,
 * so a reviewer sees engineering work before About or Skills. The detail is in #projects. */
export default function SelectedWork() {
  return (
    <section id="selected" className="selected" aria-labelledby="selected-title">
      <div className="inner">
        <h2 id="selected-title" className="selected-h2">Selected work</h2>
        <ul className="selected-grid">
          {CASES.map((c) => (
            <li key={c.id} className="selected-card">
              <p className="selected-kind">{c.kind}</p>
              <h3 className="selected-title">{c.title}</h3>
              <p className="selected-result">{c.result}</p>
              <p className="selected-caveat"><Icon name="alert" /><span><strong>Caveat:</strong> {c.caveat}</span></p>
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
