import { Evidence, Limits } from "./Evidence";

const V = "https://github.com/azizmessaoud/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a/docs/presentation/prototype-validation.md";
const R = "https://github.com/azizmessaoud/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a/README.md";

/* TR-01, TR-02, TR-03, TR-04, TR-05, TR-06, TR-08, TR-09. Ambulance result shown on the same card (rule TR-05/06). */
const RESULTS = [
  { measure: "Car greens started while people crossed, per run", ours: "≈18", base: "331–405", read: "fewer", good: true },
  { measure: "Pedestrian wait, morning peak", ours: "116.3 s", base: "144.1 s", read: "−19%", good: true },
  { measure: "Car wait, morning peak", ours: "105.9 s", base: "118.5 s", read: "−11%", good: true },
  { measure: "Car wait, emergency scenario", ours: "78.8 s", base: "65.9 s", read: "+20%", good: false },
  { measure: "Ambulance trip, emergency scenario", ours: "240.0 s", base: "213.2 s", read: "slower", good: false },
];

export default function Traffix() {
  return (
    <article className="case case-traffix" aria-labelledby="traffix-title">
      <header className="case-head">
        <p className="case-kind">Team simulation · ESPRIT course project · 2026</p>
        <h3 id="traffix-title" className="case-title">TraffiX</h3>
        <p className="case-framing">
          A multi-agent traffic-control simulation of six junctions on the real streets of central Tunis, built on SUMO and
          driven through TraCI. It is a simulation: road demand is synthetic, and nothing here is deployment evidence.
        </p>
        <p className="case-role"><strong>My part:</strong> the Control pair with Fares Ben Kacem: SUMO, observations, the A1 agent, safety and the controllers. The team adopted its agent architecture from aymenhamzik/traffix3; roles rotate.</p>
      </header>
      <div className="case-body">
        <figure className="hierarchy" aria-labelledby="traffix-fig">
          <figcaption id="traffix-fig">How a decision is made</figcaption>
          <ol>
            <li><span className="tier">Supermaster</span><span>coordinates the six junctions</span></li>
            <li><span className="tier">One master per light, J1–J6</span><span>the only writer allowed to change that light</span></li>
            <li><span className="tier">Decision log</span><span>every change carries a reason code</span></li>
            <li><span className="tier tier-read">Synapse</span><span>explains from the log; never acts on the simulation</span></li>
          </ol>
        </figure>
        <div>
          <table className="results">
            <caption>Trained models vs SUMO actuated signals · Tunis map · mean of 3 seeds · 20 Oct 2026</caption>
            <thead><tr><th scope="col">Measure</th><th scope="col">TraffiX</th><th scope="col">Actuated</th><th scope="col">Reading</th></tr></thead>
            <tbody>
              {RESULTS.map((r) => (
                <tr key={r.measure}>
                  <th scope="row">{r.measure}</th>
                  <td>{r.ours}</td>
                  <td>{r.base}</td>
                  <td className={r.good ? "read-good" : "read-bad"}>{r.good ? "Better: " : "Worse: "}{r.read}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="results-note">Ambulances were also slower than fixed-time signals (197.0 s). None of these differences is significant at p &lt; 0.05 with three seeds.</p>
        </div>
      </div>
      <Limits items={[
        "Simulation only, with synthetic road demand.",
        "Three seeds and three scenarios; no result is statistically significant yet.",
        "18 of 21 junction roads use unverified lane counts.",
        "The slower ambulance trips are not explained yet.",
      ]} />
      <Evidence links={[{ label: "README @ d54b071", url: `${R}#L1-L11` }, { label: "Validation report §5.3–5.5", url: V }]} />
    </article>
  );
}
