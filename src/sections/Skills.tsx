import Icon from "../ui/Icon";

/* Tech Superpowers, in the prototype's card view with verified content: each domain names the tools the
 * linked repository shows I used. Team ownership respected: TraffiX's React UI and DuckDB/Parquet layer
 * belonged to other pairs, so they are not credited to TraffiX here. No levels, bars or percentages. */
const G = "https://github.com/azizmessaoud";
const TRAFFIX = `${G}/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a`;
const FLY = `${G}/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204`;
const HR = `${G}/hr-anomaly-detection/blob/437a5142df8bed783a5b30ee6f02710a05c45a52`;
const SITE = `${G}/aws-superpower-portfolio/blob/main`;

const DOMAINS: { icon: Parameters<typeof Icon>[0]["name"]; title: string; chips: string[]; hi: string[]; where: string; href: string }[] = [
  { icon: "ranking", title: "Machine learning & ranking", chips: ["scikit-learn", "Random Forest", "Grouped holdout", "Precision@50"], hi: ["scikit-learn"], where: "FlyRank capstone", href: `${FLY}/work/capstone_report.md#L38-L44` },
  { icon: "agents", title: "Multi-agent systems", chips: ["SUMO", "TraCI", "Controllers", "Safety rules", "Reason codes"], hi: ["SUMO"], where: "TraffiX (my pair: control)", href: `${TRAFFIX}/README.md#L635-L648` },
  { icon: "document", title: "Document AI", chips: ["Docling", "RapidOCR", "Validation", "Anomaly detection"], hi: ["Docling"], where: "HR prototype", href: `${HR}/README.md#L1-L16` },
  { icon: "retrieval", title: "Retrieval & evaluation", chips: ["BM25", "Judged questions", "hit@k", "MRR"], hi: ["BM25"], where: "Ask my brain (this site)", href: `${SITE}/src/retrieval/bm25.ts` },
  { icon: "data", title: "Data engineering", chips: ["DuckDB", "SQL", "Pandas", "Data contracts"], hi: ["DuckDB"], where: "FlyRank capstone notebooks", href: `${FLY}/work/notebooks/w03_data_contract.ipynb` },
  { icon: "api", title: "APIs, apps & tests", chips: ["FastAPI", "Docker", "pytest", "React + TypeScript"], hi: ["FastAPI"], where: "HR prototype · this site", href: `${HR}/README.md#L310-L325` },
];
const TOOLKIT = ["PyTorch", "TensorFlow", "R", "LLMs", "NLP", "Git", "Data visualization"];

export default function Skills() {
  return (
    <section id="skills" className="section skills" aria-labelledby="skills-title">
      <div className="inner">
        <p className="sec-label">Tech Superpowers</p>
        <h2 id="skills-title" className="sec-h2">The tools I reach for when it has to work.</h2>
        <p className="sec-lead">
          Six capability domains. One through-line: every tool links to the repository where I used it.
        </p>
        <ul className="skills-grid">
          {DOMAINS.map((d) => (
            <li key={d.title} className="skill-card">
              <span className="skill-icon" aria-hidden="true"><Icon name={d.icon} /></span>
              <h3 className="skill-title">{d.title}</h3>
              <ul className="chips" aria-label={`${d.title} tools`}>
                {d.chips.map((c) => <li key={c} className={`chip${d.hi.includes(c) ? " hi" : ""}`}>{c}</li>)}
              </ul>
              <a className="skill-evidence" href={d.href}>
                <span>Used in</span> {d.where} <Icon name="external" />
              </a>
            </li>
          ))}
          <li className="skill-card skill-card-toolkit">
            <span className="skill-icon" aria-hidden="true"><Icon name="toolkit" /></span>
            <h3 className="skill-title">Also in my toolkit</h3>
            <ul className="chips" aria-label="Other tools">
              {TOOLKIT.map((c) => <li key={c} className="chip">{c}</li>)}
            </ul>
            <p className="skill-note">Listed on my portfolio; not demonstrated on this page.</p>
          </li>
        </ul>
      </div>
    </section>
  );
}
