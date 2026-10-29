import type { Portfolio } from "../content/schema";
import portfolio from "../generated/portfolio.json";
import Icon from "../ui/Icon";

/* Everything here is read from content/aws-status.yaml. The page never says more than that file proves:
 * a build file is not a deployment, and a planned service is not a connected one. */
const aws = (portfolio as Portfolio).aws;

export default function Aws() {
  return (
    <section id="aws" className="section aws" aria-labelledby="aws-title">
      <div className="inner">
        <p className="sec-label">AWS</p>
        <h2 id="aws-title" className="sec-h2">What is running on AWS, and what is not.</h2>
        <p className={`aws-status${aws.deployed ? " is-live" : ""}`} role="status">
          {aws.deployed && aws.liveUrl
            ? <>Deployed: <a href={aws.liveUrl}>{aws.liveUrl}</a>. Build record: {aws.buildRecord}</>
            : <><strong>Not deployed yet.</strong> The Amplify build configuration is prepared; no live URL or build record exists, so no deployment is claimed.</>}
          <span className="aws-checked"> Checked {aws.checkedOn}.</span>
        </p>
        <div className="aws-grid">
          <div>
            <h3 className="aws-h">Verified</h3>
            <ul className="aws-list">
              {aws.verified.map((v) => <li key={v.href}>{v.text} <a href={v.href}>Source <Icon name="external" /></a></li>)}
              {aws.connected.map((c) => <li key={c.name}>{c.name}: connected. <a href={c.evidence}>Evidence <Icon name="external" /></a></li>)}
            </ul>
            <h3 className="aws-h">Build chain</h3>
            <ol className="aws-list aws-chain">{aws.buildChain.map((b) => <li key={b}>{b}</li>)}</ol>
          </div>
          <div>
            <h3 className="aws-h">Planned, not connected</h3>
            <ul className="aws-list">
              {aws.planned.map((p) => <li key={p.name}><strong>{p.name}.</strong> {p.note}</li>)}
            </ul>
            <p className="aws-note">The working answer engine is a keyword retriever that runs in the browser, with no backend. It stays the fallback if a backend is ever added.</p>
          </div>
        </div>
        <h3 className="aws-h">Cost and safety rules</h3>
        <ul className="aws-list aws-cost">{aws.costSafety.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>
    </section>
  );
}
