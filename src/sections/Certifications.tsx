import Icon from "../ui/Icon";

/* Credentials as listed on the main portfolio (azizmessaoud.github.io/projectx0), each linking to its issuer's page.
 * Only the credential's own title and year are stated; nothing here claims what the certificate proves. */
const PRIORITY = [
  { issuer: "Oracle", title: "OCI Data Science Professional", detail: "Oracle Cloud Infrastructure 2025 Certified Data Science Professional · 2025", href: "https://catalog-education.oracle.com/ords/certview/sharebadge?id=1FBB758BADED7CB49AE091395139903D4B9D8463109AEBB0C2673FBC880253A9" },
  { issuer: "Oracle", title: "OCI AI Foundations Associate", detail: "Oracle Cloud Infrastructure 2025 Certified AI Foundations Associate · 2025", href: "https://catalog-education.oracle.com/ords/certview/sharebadge?id=7DA2ADAE20E6DA7233E485DD34299A910811A034BC4E981DACF9118671A3544C" },
  { issuer: "Microsoft", title: "Azure AI Fundamentals (AI-901)", detail: "Microsoft Certified: Azure AI Fundamentals · 2026", href: "https://learn.microsoft.com/fr-fr/users/azizmessaoud/credentials/1a2d218bd3b89433" },
  { issuer: "Microsoft", title: "Azure Data Fundamentals (DP-900)", detail: "Microsoft Certified: Azure Data Fundamentals · 2026", href: "https://learn.microsoft.com/fr-fr/users/azizmessaoud/credentials/9170ffe9ad85882" },
  { issuer: "Databricks", title: "Generative AI Fundamentals", detail: "Databricks Academy Accreditation · 2026", href: "https://credentials.databricks.com/ed7432c9-7444-441d-992a-9c19e81acea9#acc.CiyAfHEW" },
];
const LEARNING = [
  { title: "Introduction to Transformer-Based NLP", by: "NVIDIA · course · 2025", href: "https://learn.nvidia.com/certificates?id=_2SSDT3sQLis1uAoAh2SNA" },
  { title: "Fundamentals of Deep Learning", by: "NVIDIA · course · 2025", href: "https://learn.nvidia.com/certificates?id=ThehODKqTASFT20JoM1-4w" },
  { title: "Getting Started with Deep Learning", by: "NVIDIA · course · 2025", href: "https://learn.nvidia.com/certificates?id=eotempvJT_-jMSt2HqvJwg" },
  { title: "Intermediate Machine Learning", by: "Kaggle · course · 2025", href: "https://www.kaggle.com/learn/certification/azizmessaoud2002/intermediate-machine-learning" },
  { title: "Intro to Machine Learning", by: "Kaggle · course · 2024", href: "https://www.kaggle.com/learn/certification/azizmessaoud2002/intro-to-machine-learning" },
  { title: "Neo4j Fundamentals", by: "Neo4j · course · 2025", href: "https://graphacademy.neo4j.com/c/19de2cc3-211a-4104-b685-80e20558cc4c" },
  { title: "AI Fundamentals with Capstone", by: "IBM SkillsBuild · certificate · 2025", href: "https://www.credly.com/badges/211a4060-9485-4b3a-9fb9-e2d53c08e888/" },
  { title: "Elements of AI for Business", by: "MinnaLearn · course · 2025", href: "https://courses.minnalearn.com/certificate/en/elements-of-ai-for-business/c1bde2fc-3df9-41cc-903b-f90636bb12a8" },
  { title: "Hashgraph Developer", by: "The Hashgraph Association · certificate · 2025", href: "https://badges.parchment.eu/public/assertions/FsCTKOvmS4iU4tCAbMtQmQ?identity__email=aziz.messaoud@esprit.tn" },
  { title: "Scrum Fundamentals Certified", by: "SCRUMstudy · certificate · 2025", href: "https://www.scrumstudy.com/certification/verify?type=SFC&number=1098120" },
  { title: "Leadership", by: "Aspire Institute · certificate · 2026", href: "https://engage.aspireleaders.org/share/certificate/did:rcw:b3551972-403a-4976-be06-bd9c68b2b605" },
];

export default function Certifications() {
  return (
    <section id="certifications" className="section certs" aria-labelledby="certs-title">
      <div className="inner">
        <p className="sec-label">Certifications & learning</p>
        <h2 id="certs-title" className="sec-h2">Credentials you can check yourself.</h2>
        <p className="sec-lead">
          Five main credentials and eleven shorter courses. Each one links to the issuer's own page, so you don't
          have to take my word for it.
        </p>
        <ul className="skills-grid">
          {PRIORITY.map((c) => (
            <li key={c.title} className="skill-card">
              <p className="cert-issuer">{c.issuer}</p>
              <h3 className="skill-title">{c.title}</h3>
              <p className="cert-note">{c.detail}</p>
              <a className="skill-evidence" href={c.href}>Verify with {c.issuer} <Icon name="external" /></a>
            </li>
          ))}
        </ul>
        <h3 className="cert-sub">Additional learning</h3>
        <ul className="cert-learning">
          {LEARNING.map((l) => (
            <li key={l.title}><a href={l.href}>{l.title} <span>{l.by}</span></a></li>
          ))}
        </ul>
        <p className="cert-note"><a href="https://engage.aspireleaders.org/share/certificate/did:rcw:aff306a7-d8da-48a8-9ed4-378da59d2512">Letter for Leadership (Aspire Institute)</a></p>
      </div>
    </section>
  );
}
