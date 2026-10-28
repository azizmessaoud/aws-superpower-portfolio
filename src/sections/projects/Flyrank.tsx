import { Evidence, Limits } from "./Evidence";

const C = "https://github.com/azizmessaoud/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204/work/capstone_report.md";
const NB = "https://github.com/azizmessaoud/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204/work/notebooks/w05_model.ipynb";

/* FR-02 (P@50 0.94 vs 0.76 → 47 and 38 hits of 50), FR-05, FR-06, FR-07, FR-08. FR-01 (the starter-repo result) is withheld until D3. */
function Queue({ label, hits, value }: { label: string; hits: number; value: string }) {
  return (
    <div className="queue">
      <p className="queue-label"><span>{label}</span><strong>{value}</strong><span className="queue-count">{hits} of 50 top pages were hits</span></p>
      <ol className="queue-cells" aria-hidden="true">
        {Array.from({ length: 50 }, (_, i) => <li key={i} className={i < hits ? "hit" : "miss"} />)}
      </ol>
    </div>
  );
}

export default function Flyrank() {
  return (
    <article className="case case-flyrank" aria-labelledby="flyrank-title">
      <header className="case-head">
        <p className="case-kind">Internship capstone · FlyRank AI · 2026</p>
        <h3 id="flyrank-title" className="case-title">Which pages should an editor review first?</h3>
        <p className="case-framing">
          From one day of search and analytics signals, rank webpages so the most useful ones reach a human reviewer first,
          then check the ranking on clients the model never saw. It is a prioritisation signal, not a claim about what a refresh causes.
        </p>
      </header>
      <div className="case-body">
        <figure className="ranking" aria-labelledby="flyrank-fig">
          <figcaption id="flyrank-fig">Precision@50 on 1,583 held-out pages from 8 unseen clients</figcaption>
          <Queue label="Random Forest" hits={47} value="0.94" />
          <Queue label="Fixed baseline" hits={38} value="0.76" />
          <p className="metric-def">
            A hit is a page with at least 8 Search Console clicks in the next week (the training 75th percentile).
            Features from 31 March 2026; clicks from 1–7 April 2026. Filled squares are hits; outlined squares are not.
          </p>
        </figure>
        <ul className="method">
          <li><strong>Baseline first.</strong> The age-plus-visibility rule was fixed before the label was used.</li>
          <li><strong>Unseen clients.</strong> GroupShuffleSplit kept whole clients apart: 11,802 training rows from 21 clients, 1,583 test rows from 8.</li>
          <li><strong>Leakage test.</strong> A deliberately leaked label feature inflated the score and was removed before the honest run.</li>
          <li><strong>Error.</strong> R² 0.50 and MAE 2.51 clicks, against R² 0.26 for the calibrated baseline.</li>
        </ul>
      </div>
      <Limits items={[
        "One decision date and one outcome week.",
        "Observational, not causal: it does not show that editing a page increases traffic.",
        "The internship warehouse is gated, so the result cannot be fully reproduced in public.",
      ]} />
      <Evidence links={[{ label: "Capstone report @ a220b9e", url: `${C}#L55` }, { label: "Notebook w05 (cell output)", url: NB }]} />
    </article>
  );
}
