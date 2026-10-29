/* The Terminal Explorer is Ask my brain: verified evidence reached by typing.
 * Pure: takes a command line, returns lines to print. Every fact comes from the corpus or the
 * evidence register; nothing here is invented, and `ask` uses the same retriever. */
import type { Certification, Corpus } from "../content/schema";
import { LABELS, type LabelKey } from "../content/labels";
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
  ["certs [issuer]", "certifications, each with its issuer's page"],
  ["label <name>", "data · judging · failures · review"],
  ["ask <question>", "search the verified passages"],
  ["contact", "how to reach me"],
  ["clear", "clear the screen"],
];

/* Words that mean "show me credentials". Issuer words map to the issuer names used in content/certifications.yaml. */
const CERT_WORDS = /certif|credential|badge|diploma|accredit|\bcerts?\b|\bcourses?\b|\blearning\b/i;
const ISSUER_ALIAS: Record<string, string> = { azure: "microsoft", amazon: "aws", oci: "oracle", gcp: "google" };
/* Well-known issuers I hold nothing from: asking about them gets a plain "not in my list". */
const OTHER_ISSUERS = ["aws", "google", "cisco", "comptia", "pmi", "red hat", "salesforce", "tensorflow", "hashicorp", "snowflake"];
const STOP = new Set(["what", "whats", "what's", "is", "are", "the", "a", "an", "do", "does", "you", "your", "aziz", "azizs", "have", "has", "his", "he", "any", "of", "to", "and", "or", "with", "got", "show", "me", "list", "all", "my", "i", "please", "tell", "about", "certified", "in"]);

export function createTerminal(corpus: Corpus, certifications: Certification[] = []) {
  const retriever = createRetriever(corpus);
  const resolve = (name: string) => PROJECTS[ALIASES[name] ?? name] ? (ALIASES[name] ?? name) : null;

  function certLines(query: string): Line[] {
    const words = query.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9+ ]/g, " ").split(" ").filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => ISSUER_ALIAS[w] ?? w);
    const issuers = [...new Set(certifications.map((c) => c.issuer.toLowerCase()))];
    const asked = words.filter((w) => issuers.some((i) => i.includes(w)));
    const missing = OTHER_ISSUERS.filter((i) => words.includes(i) || query.toLowerCase().includes(i));
    const out: Line[] = [];
    let shown = certifications;
    if (asked.length) shown = certifications.filter((c) => asked.some((w) => c.issuer.toLowerCase().includes(w)));
    if (missing.length && !asked.length)
      out.push({ kind: "muted", text: `I can't verify a ${missing.map((m) => m.toUpperCase()).join(" / ")} credential: none is in my list, so none is claimed. What I can verify:` });
    if (!certifications.length) return [{ kind: "error", text: "No certifications loaded." }];
    out.push({ kind: "heading", text: asked.length ? `Credentials from ${[...new Set(shown.map((c) => c.issuer))].join(", ")}` : "Certifications (each links to the issuer's own page)" });
    for (const c of shown) out.push({ kind: "link", text: `  ${c.title} · ${c.issuer} · ${c.year}${c.kind === "learning" ? " (course)" : ""}`, href: c.href });
    return out;
  }

  function question(input: string): Line[] {
    const q = input.toLowerCase();
    if (CERT_WORDS.test(q) || OTHER_ISSUERS.some((i) => new RegExp(`\\b${i}\\b`).test(q)) || /\b(oracle|microsoft|azure|databricks|nvidia|kaggle|ibm)\b/.test(q)) return certLines(input);
    if (/\b(contact|email|e-mail|reach|linkedin|hire|hiring)\b/.test(q)) return run("contact") as Line[];
    if (/\b(skills?|tools?|stack|technolog)/.test(q)) return run("skills") as Line[];
    if (/\b(who are you|who is aziz|about|study|studies|esprit|graduate|school)\b/.test(q)) return run("about") as Line[];
    const results = retriever.search(input, 2);
    if (!results.length)
      return [
        { kind: "muted", text: "No verified passage answers that, so I won't guess." },
        { kind: "muted", text: "Ask about TraffiX, FlyRank, the HR prototype or my certifications, or type help for the commands." },
      ];
    return results.flatMap((r) => [
      { kind: "heading" as const, text: `${r.passage.projectTitle} — ${r.passage.title}` },
      { kind: "text" as const, text: `  ${r.passage.text}` },
      ...r.passage.limitations.map((l) => ({ kind: "limit" as const, text: `  – ${l}` })),
      ...r.passage.evidence.map((e) => ({ kind: "link" as const, text: `  evidence: ${e.label}`, href: e.url })),
    ]);
  }

  function run(raw: string): Line[] | "clear" {
    const input = raw.trim().replace(/\s+/g, " ");
    const [cmd = "", ...rest] = input.split(" ");
    const arg = rest.join(" ");
    switch (cmd.toLowerCase()) {
      case "": return [];
      case "help":
        return [
          { kind: "heading", text: "Commands" },
          ...COMMANDS.map(([c, d]) => ({ kind: "text" as const, text: `  ${c.padEnd(17)}${d}` })),
          { kind: "muted", text: "You can also type a question in plain words, for example: what are Aziz's certifications?" },
        ];
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
        return question(arg);
      }
      case "certs":
      case "certifications":
      case "certificates":
        return certLines(arg);
      case "label": {
        const key = resolve(arg.toLowerCase()) as LabelKey | null;
        if (!key) return [{ kind: "error", text: `label needs a project: traffix · flyrank · hr` }];
        const l = LABELS[key];
        const block = (title: string, items: string[], kind: "text" | "limit"): Line[] => [{ kind: "heading", text: title }, ...items.map((t) => ({ kind, text: `  – ${t}` }))];
        return [
          ...block(`Data — ${PROJECTS[key].title}`, l.data, "text"),
          ...block("How it was judged", l.evaluation, "text"),
          ...block("Where it fails", l.fails, "limit"),
          ...block("Who reviews the output", l.review, "text"),
          { kind: "link", text: `  evidence: ${PROJECTS[key].evidence.text}`, href: PROJECTS[key].evidence.href },
        ];
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
        /* A sentence is a question, not a mistyped command. One unknown word is still reported as a command. */
        if (input.includes(" ") || input.endsWith("?")) return question(input);
        return [{ kind: "error", text: `command not found: ${cmd}` }, { kind: "muted", text: "Type help for the commands, or ask a question in plain words." }];
    }
  }

  return { run };
}
