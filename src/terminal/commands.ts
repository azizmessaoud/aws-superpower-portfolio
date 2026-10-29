/* The Terminal Explorer: a second way into the same verified evidence as Ask my brain.
 * Pure: takes a command line, returns lines to print. Every fact comes from the corpus or the
 * evidence register; nothing here is invented, and `ask` uses the same retriever. */
import type { Corpus } from "../content/schema";
import { createRetriever } from "../retrieval/retriever";

export type Line =
  | { kind: "text" | "muted" | "heading" | "error" | "ok" | "limit"; text: string }
  | { kind: "link"; text: string; href: string };

const R = "https://github.com/azizmessaoud";
const PROJECTS: Record<string, { title: string; summary: string; facts: string[]; limits: string[]; evidence: { text: string; href: string } }> = {
  traffix: {
    title: "TraffiX — multi-agent traffic-control simulation",
    summary: "Six junctions on the real streets of central Tunis, built on SUMO and driven through TraCI. My pair: SUMO, observations, the A1 agent, safety and the controllers.",
    facts: [
      "≈18 car greens started during a pedestrian crossing per run, vs 331–405 with actuated signals",
      "Pedestrian wait, morning peak: 116.3 s vs 144.1 s",
      "Ambulance trips: 240.0 s vs 213.2 s actuated (slower)",
    ],
    limits: ["Simulation only; synthetic demand", "3 seeds, 3 scenarios; nothing significant at p < 0.05", "Architecture adopted from aymenhamzik/traffix3"],
    evidence: { text: "validation report §5.3–5.5", href: `${R}/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a/docs/presentation/prototype-validation.md` },
  },
  flyrank: {
    title: "FlyRank capstone — ranking pages for human review",
    summary: "From one day of signals, rank webpages so the most useful reach an editor first; tested on 8 clients the model never saw.",
    facts: [
      "Precision@50: 0.94 (Random Forest) vs 0.76 (fixed baseline), 1,583 held-out pages",
      "Hit = ≥ 8 clicks in the next week (training 75th percentile)",
      "R² 0.50, MAE 2.51 clicks vs R² 0.26 baseline",
    ],
    limits: ["One decision date and one outcome week", "Observational, not causal", "Gated warehouse limits public reproduction"],
    evidence: { text: "capstone report", href: `${R}/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204/work/capstone_report.md#L55` },
  },
  hr: {
    title: "HR document checks — prototype",
    summary: "Local pipeline: pre-flight checks → Docling → RapidOCR fallback → validation → anomaly detection → explained flags → a person decides.",
    facts: ["Runs as a synchronous FastAPI demo with in-memory jobs", "Never writes to an HR information system on its own"],
    limits: ["OCR accuracy on real documents has not been measured", "Synthetic sample documents only", "Celery, Redis and PostgreSQL are planned, not built"],
    evidence: { text: "README", href: `${R}/hr-anomaly-detection/blob/437a5142df8bed783a5b30ee6f02710a05c45a52/README.md#L1-L16` },
  },
};
const ALIASES: Record<string, string> = { "hr-docs": "hr", hrdocs: "hr", "hr-anomaly-detection": "hr", fly: "flyrank" };

export const COMMANDS: [string, string][] = [
  ["help", "list commands"],
  ["about", "who I am"],
  ["skills", "tools, by where I used them"],
  ["projects", "the three projects"],
  ["project <name>", "traffix · flyrank · hr"],
  ["limits <name>", "what a project does not prove"],
  ["ask <question>", "search the verified passages"],
  ["contact", "how to reach me"],
  ["clear", "clear the screen"],
];

export function createTerminal(corpus: Corpus) {
  const retriever = createRetriever(corpus);
  const resolve = (name: string) => PROJECTS[ALIASES[name] ?? name] ? (ALIASES[name] ?? name) : null;

  function run(raw: string): Line[] | "clear" {
    const input = raw.trim().replace(/\s+/g, " ");
    const [cmd = "", ...rest] = input.split(" ");
    const arg = rest.join(" ");
    switch (cmd.toLowerCase()) {
      case "": return [];
      case "help":
        return [{ kind: "heading", text: "Commands" }, ...COMMANDS.map(([c, d]) => ({ kind: "text" as const, text: `  ${c.padEnd(17)}${d}` }))];
      case "about":
        return [
          { kind: "heading", text: "Aziz Messaoud" },
          { kind: "text", text: "Data Science Engineering student at ESPRIT, Tunisia; expecting to graduate in 2027." },
          { kind: "text", text: "Looking for a 2027 PFE internship: AI/ML engineering, applied data science or AI research." },
          { kind: "muted", text: "Works in Arabic, French and English." },
        ];
      case "skills":
        return [
          { kind: "heading", text: "Tools, by where I used them" },
          { kind: "text", text: "  Machine learning   scikit-learn · Random Forest · grouped holdout  (FlyRank)" },
          { kind: "text", text: "  Multi-agent        SUMO · TraCI · controllers · reason codes       (TraffiX)" },
          { kind: "text", text: "  Document AI        Docling · RapidOCR · anomaly detection          (HR prototype)" },
          { kind: "text", text: "  Retrieval          BM25 · hit@k · MRR                              (this site)" },
          { kind: "text", text: "  Data               DuckDB · Parquet · SQL                          (FlyRank)" },
          { kind: "text", text: "  APIs and tests     FastAPI · Docker · pytest                       (HR prototype)" },
          { kind: "muted", text: "  Also in my toolkit, not shown here: PyTorch · TensorFlow · R · LLMs · NLP · Git" },
        ];
      case "projects":
        return [
          { kind: "heading", text: "Projects — type `project <name>` for details" },
          ...Object.entries(PROJECTS).map(([k, p]) => ({ kind: "text" as const, text: `  ${k.padEnd(9)}${p.title}` })),
        ];
      case "project":
      case "limits": {
        const key = resolve(arg.toLowerCase());
        if (!key) return [{ kind: "error", text: `unknown project "${arg}". Try: traffix · flyrank · hr` }];
        const p = PROJECTS[key];
        if (cmd.toLowerCase() === "limits")
          return [{ kind: "heading", text: `Limits — ${p.title}` }, ...p.limits.map((l) => ({ kind: "limit" as const, text: `  – ${l}` })), { kind: "link", text: `  evidence: ${p.evidence.text}`, href: p.evidence.href }];
        return [
          { kind: "heading", text: p.title },
          { kind: "text", text: `  ${p.summary}` },
          ...p.facts.map((f) => ({ kind: "ok" as const, text: `  • ${f}` })),
          ...p.limits.map((l) => ({ kind: "limit" as const, text: `  – ${l}` })),
          { kind: "link", text: `  evidence: ${p.evidence.text}`, href: p.evidence.href },
        ];
      }
      case "ask": {
        if (!arg) return [{ kind: "error", text: "ask needs a question, e.g. ask Is TraffiX deployed?" }];
        const results = retriever.search(arg, 2);
        if (!results.length) return [{ kind: "muted", text: "No verified passage answers that. Try asking about TraffiX, FlyRank or the HR prototype." }];
        return results.flatMap((r) => [
          { kind: "heading" as const, text: `${r.passage.projectTitle} — ${r.passage.title}` },
          { kind: "text" as const, text: `  ${r.passage.text}` },
          ...r.passage.limitations.map((l) => ({ kind: "limit" as const, text: `  – ${l}` })),
          ...r.passage.evidence.map((e) => ({ kind: "link" as const, text: `  evidence: ${e.label}`, href: e.url })),
        ]);
      }
      case "contact":
        return [
          { kind: "heading", text: "Contact" },
          { kind: "link", text: "  aziz.messaoud@esprit.tn", href: "mailto:aziz.messaoud@esprit.tn" },
          { kind: "link", text: "  github.com/azizmessaoud", href: "https://github.com/azizmessaoud" },
          { kind: "link", text: "  linkedin.com/in/azizmessaoud", href: "https://www.linkedin.com/in/azizmessaoud/" },
        ];
      case "clear": return "clear";
      default:
        return [{ kind: "error", text: `command not found: ${cmd}` }, { kind: "muted", text: "Type help for the list." }];
    }
  }

  return { run };
}
