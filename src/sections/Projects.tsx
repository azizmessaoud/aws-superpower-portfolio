import Traffix from "./projects/Traffix";
import Flyrank from "./projects/Flyrank";
import HrDocs from "./projects/HrDocs";
import Icon from "../ui/Icon";

/* Wording from the main portfolio's "Supporting projects"; the technical exercise is labelled as such there too. */
const SMALL = [
  { title: "Tunisian Administrative Procedures Assistant", text: "College team project: a multilingual assistant that helps users navigate administrative procedures. I worked on the retrieval-augmented generation (RAG) component. Implementation details and my contribution are based on my own account; the README says it is not legal advice or official validation.", tags: ["RAG", "Qdrant", "Ollama", "FastAPI", "Telegram"], link: "View team repository", href: "https://github.com/EyaLaourine/tunisian-administrative-procedures-assistant/blob/229191a612e7bb6a5809e8e9203db6b722fb1d8c/README.md" },
  { title: "Breast Cancer ML", text: "Preprocessing, PCA, and a comparison of SVM, MLP and tree models with cross-validation, served through a small Flask API. A technical exercise, not a clinical tool.", tags: ["scikit-learn", "PCA", "SVM", "MLP", "Flask", "Docker"], link: "View code", href: "https://github.com/azizmessaoud/breast-cancer-ml" },
  { title: "ClusterCrew Analytics", text: "Healthcare analytics dashboards for exploring operational data.", tags: ["Power BI", "Data visualization", "Healthcare BI"], link: "Live demo (wakes in about a minute)", href: "https://clustercrew-analytics.onrender.com/overview" },
  { title: "InnoTravel", text: "Team academic project: a travel-management system covering planning, booking and REST API integration across desktop and web.", tags: ["JavaFX", "Symfony", "MySQL", "REST API"], link: "View code", href: "https://github.com/oumaymasaddouri/InnoTravel-PiDev-Symfony.git" },
];

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
