import type { Portfolio } from "../content/schema";
import portfolio from "../generated/portfolio.json";
import Icon from "../ui/Icon";

/* Credentials come from content/certifications.yaml (see docs/ADDING-CONTENT.md); each links to its issuer's page. */
const { certifications } = portfolio as Portfolio;
const MAIN = certifications.filter((c) => c.kind === "main");
const LEARNING = certifications.filter((c) => c.kind === "learning");
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const word = (n: number) => (WORDS[n] ?? String(n)).toLowerCase();

export default function Certifications() {
  return (
    <section id="certifications" className="section certs" aria-labelledby="certs-title">
      <div className="inner">
        <p className="sec-label">Certifications & learning</p>
        <h2 id="certs-title" className="sec-h2">Credentials you can check yourself.</h2>
        <p className="sec-lead">
          {MAIN.length} main credential{MAIN.length === 1 ? "" : "s"} and {word(LEARNING.length)} shorter course{LEARNING.length === 1 ? "" : "s"}. Each one links to the
          issuer's own page, so you don't have to take my word for it.
        </p>
        <ul className="skills-grid">
          {MAIN.map((c) => (
            <li key={c.title} className="skill-card">
              <p className="cert-issuer">{c.issuer}</p>
              <h3 className="skill-title">{c.title}</h3>
              <p className="cert-note">{c.detail} · {c.year}</p>
              <a className="skill-evidence" href={c.href}>Verify with {c.issuer} <Icon name="external" /></a>
            </li>
          ))}
        </ul>
        {LEARNING.length > 0 && (
          <>
            <h3 className="cert-sub">Additional learning</h3>
            <ul className="cert-learning">
              {LEARNING.map((l) => (
                <li key={l.title}>
                  <a href={l.href}>{l.title} <span>{l.issuer} · {l.detail} · {l.year}</span></a>
                  {l.extra && <a href={l.extra.href}>{l.extra.label}</a>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
