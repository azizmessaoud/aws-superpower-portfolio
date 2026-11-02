import { useCallback, useEffect, useRef, useState } from "react";
import Traffix from "./projects/Traffix";
import Flyrank from "./projects/Flyrank";
import HrDocs from "./projects/HrDocs";
import MiniViz from "./projects/MiniViz";
import { CASES, type CaseSummary } from "./projects/summary";
import Icon from "../ui/Icon";
import type { Portfolio } from "../content/schema";
import portfolio from "../generated/portfolio.json";

/* Cards come from content/small-projects.yaml (see docs/ADDING-CONTENT.md). */
const SMALL = (portfolio as Portfolio).smallProjects;

type Id = CaseSummary["id"];
const STUDY: Record<Id, () => JSX.Element> = { traffix: Traffix, flyrank: Flyrank, hr: HrDocs };
const fromHash = (): Id | null => { const m = /^#project-(traffix|flyrank|hr)$/.exec(location.hash); return m ? (m[1] as Id) : null; };

/* The three flagship projects are cards. One case study opens under the cards at a time; it is the full text, results table and
 * evidence links, unchanged. A link to #project-traffix (from Selected work, from an answer, or typed) opens it, and the open one
 * is kept in the address so it can be shared. */
export default function Projects() {
  const [open, setOpen] = useState<Id | null>(fromHash);
  const scrollToStudy = useRef(false);
  const cardButtons = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const onHash = () => { const id = fromHash(); if (id) { scrollToStudy.current = true; setOpen(id); } };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!open || !scrollToStudy.current) return;
    scrollToStudy.current = false;
    document.getElementById(`project-${open}`)?.scrollIntoView({ block: "start" });
  }, [open]);

  const choose = useCallback((id: Id) => {
    history.replaceState(null, "", `#project-${id}`);
    scrollToStudy.current = true;
    setOpen(id);
  }, []);
  const close = useCallback(() => {
    const was = open;
    history.replaceState(null, "", "#projects");
    setOpen(null);
    if (was) requestAnimationFrame(() => cardButtons.current[was]?.focus());
  }, [open]);

  const Study = open ? STUDY[open] : null;
  return (
    <section id="projects" className="section projects" aria-labelledby="projects-title">
      <div className="inner">
        <p className="sec-label">Projects</p>
        <h2 id="projects-title" className="sec-h2">Three projects, with the evidence next to each.</h2>
        <p className="sec-lead">Pick a card for the full case study: where the data came from, how it was judged, where it fails, and who reviews the output.</p>
        <ul className="pcards">
          {CASES.map((c) => {
            const isOpen = open === c.id;
            return (
              <li key={c.id} className="pcard spot" data-open={isOpen}>
                <MiniViz id={c.id} />
                <p className="pcard-kind">{c.kind}</p>
                <h3 className="pcard-title">{c.title}</h3>
                <p className="pcard-blurb">{c.blurb}</p>
                <ul className="chips" aria-label={`${c.title} tools`}>{c.tags.map((t) => <li key={t} className="chip">{t}</li>)}</ul>
                <button
                  type="button" className="pcard-open" aria-expanded={isOpen} aria-controls={`project-${c.id}`}
                  ref={(el) => { cardButtons.current[c.id] = el; }}
                  onClick={() => (isOpen ? close() : choose(c.id))}
                >
                  {isOpen ? "Close the case study" : "Read the case study"} <Icon name={isOpen ? "close" : "arrow"} />
                </button>
              </li>
            );
          })}
        </ul>
        {Study && (
          <div className="case-panel">
            <button type="button" className="case-close" onClick={close}><Icon name="close" /> Close the case study</button>
            <Study />
          </div>
        )}
        <div className="small-projects">
          <h3>Smaller projects</h3>
          <ul className="small-grid">
            {SMALL.map((s) => (
              <li key={s.title} className="skill-card spot">
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
