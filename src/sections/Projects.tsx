import Traffix from "./projects/Traffix";
import Flyrank from "./projects/Flyrank";
import HrDocs from "./projects/HrDocs";
import Icon from "../ui/Icon";
import type { Portfolio } from "../content/schema";
import portfolio from "../generated/portfolio.json";

/* Cards come from content/small-projects.yaml (see docs/ADDING-CONTENT.md). */
const SMALL = (portfolio as Portfolio).smallProjects;

export default function Projects() {
  return (
    <section id="projects" className="section projects" aria-labelledby="projects-title">
      <div className="inner">
        <p className="sec-label">Projects</p>
        <h2 id="projects-title" className="sec-h2">Three projects, each with its evidence.</h2>
        <p className="sec-lead">
          A team simulation, an internship capstone and a prototype. Each shows what was measured, under which conditions,
          and what it does not prove.
        </p>
        <Traffix />
        <Flyrank />
        <HrDocs />
        <div className="small-projects">
          <h3>Smaller projects</h3>
          <ul className="small-grid">
            {SMALL.map((s) => (
              <li key={s.title} className="skill-card">
                <h4 className="skill-title">{s.title}</h4>
                <p>{s.text}</p>
                <ul className="chips" aria-label={`${s.title} tools`}>{s.tags.map((t) => <li key={t} className="chip">{t}</li>)}</ul>
                <a className="skill-evidence" href={s.href}>{s.link} <Icon name="external" /></a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
