import Traffix from "./projects/Traffix";
import Flyrank from "./projects/Flyrank";
import HrDocs from "./projects/HrDocs";

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
      </div>
    </section>
  );
}
