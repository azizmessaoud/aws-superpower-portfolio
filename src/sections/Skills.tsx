import type { Portfolio } from "../content/schema";
import portfolio from "../generated/portfolio.json";
import Icon from "../ui/Icon";

/* Skill cards come from content/skills.yaml (see docs/ADDING-CONTENT.md): each domain names the tools the linked
 * repository shows I used. Team ownership is respected: the RAG assistant is a team project and its card names only
 * my part, from my own account; TraffiX's React UI and DuckDB/Parquet layer belonged to other pairs. No levels, bars
 * or percentages. */
const ALL = (portfolio as Portfolio).skills;
const DOMAINS = ALL.filter((s) => s.icon !== "toolkit");
const TOOLKIT = ALL.find((s) => s.icon === "toolkit");

export default function Skills() {
  return (
    <section id="skills" className="section skills" aria-labelledby="skills-title">
      <div className="inner">
        <p className="sec-label">Tech Superpowers</p>
        <h2 id="skills-title" className="sec-h2">Tools, and where I used each one.</h2>
        <p className="sec-lead">
          Each card links to the repository where I used the tool.
        </p>
        <ul className="skills-grid">
          {DOMAINS.map((d) => (
            <li key={d.title} className="skill-card">
              <span className="skill-icon" aria-hidden="true"><Icon name={d.icon} /></span>
              <h3 className="skill-title">{d.title}</h3>
              <ul className="chips" aria-label={`${d.title} tools`}>
                {d.chips.map((c) => <li key={c} className={`chip${d.hi.includes(c) ? " hi" : ""}`}>{c}</li>)}
              </ul>
              {d.href && <a className="skill-evidence" href={d.href}>
                <span>Used in</span> {d.where} <Icon name="external" />
              </a>}
            </li>
          ))}
          <li className="skill-card skill-card-toolkit">
            <span className="skill-icon" aria-hidden="true"><Icon name="toolkit" /></span>
            <h3 className="skill-title">Also in my toolkit</h3>
            <ul className="chips" aria-label="Other tools">
              {TOOLKIT?.chips.map((c) => <li key={c} className="chip">{c}</li>)}
            </ul>
            <p className="skill-note">Listed on my portfolio; not demonstrated on this page.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
