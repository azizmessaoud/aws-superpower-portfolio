/* SK-01: the live portfolio's working toolkit, tied to the project that used each tool where a repo shows it.
 * No levels, bars or percentages. */
const USED = [
  { tool: "Python", where: ["TraffiX", "FlyRank capstone", "HR document checks"] },
  { tool: "SUMO + TraCI", where: ["TraffiX"] },
  { tool: "scikit-learn", where: ["FlyRank capstone"] },
  { tool: "FastAPI", where: ["HR document checks"] },
  { tool: "Docling + RapidOCR", where: ["HR document checks"] },
];
const ALSO = ["SQL", "R", "PyTorch", "TensorFlow", "NLP", "LLMs", "Multi-agent systems", "Docker", "Git", "Data visualization"];

export default function Skills() {
  return (
    <section id="skills" className="section skills" aria-labelledby="skills-title">
      <div className="inner">
        <p className="sec-label">Skills</p>
        <h2 id="skills-title" className="sec-h2">Tools, tied to where I used them.</h2>
        <p className="sec-lead">
          The first list shows tools you can check in the repositories on this page. The second is the rest of my working
          toolkit, listed on my portfolio but not demonstrated here.
        </p>
        <div className="skills-grid">
          <div>
            <h3 className="skills-h3">Used in the projects below</h3>
            <ul className="tool-list">
              {USED.map((u) => (
                <li key={u.tool}>
                  <span className="tool">{u.tool}</span>
                  <span className="tool-where">{u.where.join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="skills-h3">Also in my toolkit</h3>
            <ul className="chips">
              {ALSO.map((s) => <li key={s} className="chip">{s}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
