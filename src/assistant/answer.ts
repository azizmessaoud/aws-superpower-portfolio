/* The answer engine behind the hero panel and the terminal. Deterministic and browser-only: no backend,
 * no model, no network. Every factual answer carries the specific source that supports it, and four outcomes
 * stay distinct: supported, contradicted (the evidence says the opposite of the question's premise),
 * not_verified (no evidence either way) and error (the question could not be processed). */
import type { Corpus, Portfolio } from "../content/schema";
import { LABELS, LABEL_KEYS } from "../content/labels";
import { createRetriever } from "../retrieval/retriever";

export type Outcome = "supported" | "contradicted" | "not_verified" | "error";
export interface Evidence { label: string; url: string }
export interface Answer {
  outcome: Outcome;
  intent: string;
  title: string;
  answer: string;
  evidence: Evidence[];
  limitations: string[];
}

export const MAX_QUESTION = 200;
const SUGGEST = "Ask about TraffiX, FlyRank, the HR prototype, AWS hosting status or my certifications, or type help for the commands.";

const AWS_SERVICES: { name: string; re: RegExp }[] = [
  { name: "Amazon Bedrock", re: /\bbedrock\b/i },
  { name: "AWS Lambda", re: /\blambda\b/i },
  { name: "Amazon API Gateway", re: /\bapi gateway\b/i },
  { name: "Amazon S3 or Bedrock Knowledge Bases", re: /\b(s3|knowledge bases?)\b/i },
];
const OTHER_ISSUERS = ["aws", "amazon", "google", "gcp", "cisco", "comptia", "pmi", "red hat", "salesforce", "tensorflow", "hashicorp", "snowflake"];
const ISSUER_ALIAS: Record<string, string> = { azure: "microsoft", oci: "oracle" };
const CERT_WORDS = /certif|credential|badge|diploma|accredit|\bcerts?\b|\bcourses?\b|\blearning\b|practitioner/i;
const STOP = new Set(["what", "whats", "what's", "is", "are", "the", "a", "an", "do", "does", "you", "your", "aziz", "azizs", "have", "has", "his", "he", "any", "of", "to", "and", "or", "with", "got", "show", "me", "list", "all", "my", "i", "please", "tell", "about", "certified", "in", "certificate", "certification", "certifications", "certifs", "cert", "certs", "credential", "credentials", "cloud", "practitioner"]);
const words = (s: string) => s.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9+ ]/g, " ").split(" ").filter(Boolean);

export function createAssistant(corpus: Corpus, portfolio: Portfolio) {
  const retriever = createRetriever(corpus);
  const { aws, certifications, skills, interview } = portfolio;
  const byPassage = new Map(corpus.passages.map((p) => [p.id, p]));
  const awsStatusEvidence: Evidence = { label: "aws-status.yaml (this site's AWS record)", url: aws.verified[0] ? "https://github.com/azizmessaoud/aws-superpower-portfolio/blob/main/content/aws-status.yaml" : "" };
  const amplifyEvidence: Evidence = { label: "amplify.yml @ 0fa4d70", url: aws.verified[0].href };
  const pkgEvidence: Evidence = { label: "package.json @ 0fa4d70", url: aws.verified[1].href };

  const make = (a: Partial<Answer> & Pick<Answer, "outcome" | "intent" | "title" | "answer">): Answer => ({ evidence: [], limitations: [], ...a });

  function awsService(name: string): Answer {
    const hit = aws.connected.find((c) => c.name.toLowerCase().includes(name.toLowerCase().split(" ").pop()!));
    if (hit)
      return make({ outcome: "supported", intent: "aws-service", title: `${hit.name}: connected`, answer: `${hit.name} is recorded as connected.`, evidence: [{ label: `${hit.name} evidence`, url: hit.evidence }, awsStatusEvidence], limitations: ["Only what the linked evidence shows is claimed."] });
    const planned = aws.planned.find((p) => p.name.toLowerCase().includes(name.toLowerCase().split(" ").pop()!));
    return make({
      outcome: "not_verified", intent: "aws-service", title: `${name}: not verified`,
      answer: `Not verified. Nothing in this repository shows ${name} connected to this site. ${planned ? `It is listed as planned only: ${planned.note}` : "It is not listed."} The working answer engine is a keyword retriever that runs in your browser.`,
      evidence: [awsStatusEvidence, pkgEvidence],
      limitations: ["Not verified is not proof of absence: it means this site's evidence does not show it.", "A dependency, a document or a plan alone would not count as use."],
    });
  }

  function awsHosting(): Answer {
    if (aws.deployed && aws.liveUrl)
      return make({
        outcome: "supported", intent: "aws-status", title: "AWS hosting: deployment recorded",
        answer: `Recorded as deployed at ${aws.liveUrl}. Build record: ${aws.buildRecord}`,
        evidence: [awsStatusEvidence, amplifyEvidence],
        limitations: ["This is the site's own record. Open the URL and the Amplify build record to check it.", ...aws.planned.map((p) => `${p.name}: planned, not connected.`)],
      });
    return make({
      outcome: "not_verified", intent: "aws-status", title: "AWS hosting: deployment not verified",
      answer: `Deployment is not verified. An Amplify build specification exists (npm ci, npm run build, serve dist), but a configuration file does not prove a deployment, and no live URL or build record is recorded yet. Prepared, not deployed.`,
      evidence: [amplifyEvidence, awsStatusEvidence],
      limitations: [...aws.planned.map((p) => `${p.name}: planned, not connected.`)],
    });
  }

  function certs(query: string): Answer {
    const q = query.toLowerCase();
    const ws = words(query).map((w) => ISSUER_ALIAS[w] ?? w);
    const issuers = [...new Set(certifications.map((c) => c.issuer.toLowerCase()))];
    const asked = ws.filter((w) => w.length >= 3 && !STOP.has(w) && issuers.some((i) => i.includes(w)));
    const missing = OTHER_ISSUERS.filter((i) => new RegExp(`\\b${i}\\b`).test(q) && !issuers.some((x) => x.includes(i)));
    const shown = asked.length ? certifications.filter((c) => asked.some((w) => c.issuer.toLowerCase().includes(w))) : certifications;
    const line = (c: (typeof certifications)[number]) => `${c.title} · ${c.issuer} · ${c.year}${c.kind === "learning" ? " (course)" : ""}`;
    const evidence = shown.map((c) => ({ label: line(c), url: c.href }));
    if (missing.length && !asked.length)
      return make({
        outcome: "not_verified", intent: "certifications", title: "Certification: not verified",
        answer: `I can't verify a ${missing.map((m) => m.toUpperCase()).join(" / ")} credential: none is in my list, so none is claimed. What I can verify: ${certifications.filter((c) => c.kind === "main").map((c) => c.title).join(", ")}, plus ${certifications.filter((c) => c.kind === "learning").length} shorter courses.`,
        evidence,
        limitations: ["Each credential links to its issuer's own page; open it to check."],
      });
    return make({
      outcome: "supported", intent: "certifications", title: asked.length ? `Credentials from ${[...new Set(shown.map((c) => c.issuer))].join(", ")}` : "Certifications",
      answer: shown.map(line).join("; ") + ".",
      evidence,
      limitations: ["Each link is the issuer's own verification page; I have not re-checked them since copying them from my earlier portfolio on 29 Oct 2026."],
    });
  }

  function tools(): Answer {
    const ds = skills.filter((s) => s.icon !== "toolkit");
    return make({
      outcome: "supported", intent: "tools", title: "Tools, and where I used them",
      answer: ds.map((s) => `${s.title}: ${s.chips.join(", ")} (${s.where})`).join(". ") + ".",
      evidence: ds.filter((s) => s.href).map((s) => ({ label: `${s.title} · ${s.where}`, url: s.href! })),
      limitations: [`Also on my portfolio but not demonstrated here: ${skills.find((s) => s.icon === "toolkit")?.chips.join(", ")}.`, "Team projects: I name only my part."],
    });
  }

  function interviewQs(): Answer {
    const qs = interview.map((i) => ({ ...i, p: byPassage.get(i.passage)! })).filter((i) => i.p);
    return make({
      outcome: "supported", intent: "interview", title: "What to ask me in an interview",
      answer: qs.map((q, i) => `${i + 1}. ${q.question}`).join(" "),
      evidence: qs.map((q) => q.p.evidence[0]).filter((e, i, a) => e && a.findIndex((x) => x.url === e.url) === i),
      limitations: ["These are suggested questions, not claims. Each links to the passage that holds the evidence."],
    });
  }

  function limitations(): Answer {
    const ev: Evidence[] = []; const lim: string[] = [];
    for (const k of LABEL_KEYS) { lim.push(...LABELS[k].fails.slice(0, 2).map((f) => `${k === "hr" ? "HR" : k === "flyrank" ? "FlyRank" : "TraffiX"}: ${f}`)); }
    for (const id of ["tr-limits", "fr-p50", "hr-accuracy"]) ev.push(...(byPassage.get(id)?.evidence ?? []).slice(0, 1));
    return make({ outcome: "supported", intent: "limitations", title: "Limits of the results", answer: "Every result here has limits next to it. The main ones are listed below; ask about one project for its full list.", evidence: ev, limitations: lim });
  }

  function simple(intent: string, title: string, answer: string, evidence: Evidence[]): Answer {
    return make({ outcome: "supported", intent, title, answer, evidence });
  }

  function ask(raw: string): Answer {
    const input = raw.trim().replace(/\s+/g, " ").replace(/^ask\s+/i, "");
    if (!input) return make({ outcome: "error", intent: "invalid", title: "No question", answer: "Type a question first." });
    if (input.length > MAX_QUESTION) return make({ outcome: "error", intent: "invalid", title: "Question too long", answer: `Questions are limited to ${MAX_QUESTION} characters; this one has ${input.length}.` });
    const q = input.toLowerCase();

    for (const s of AWS_SERVICES) if (s.re.test(q)) return awsService(s.name);
    if (/\b(aws|amazon)\b/.test(q) && CERT_WORDS.test(q)) return certs(input);
    if (/\b(aws|amazon|amplify)\b/.test(q) || /(hosting|hosted|site|website|portfolio).*(deploy|live|status|hosted)|(deploy|live).*(site|website|portfolio)/.test(q) && !/traffix|simulation/.test(q)) return awsHosting();
    if (CERT_WORDS.test(q) || /\b(oracle|microsoft|azure|databricks|nvidia|kaggle|ibm|google|gcp)\b/.test(q)) return certs(input);
    if (/interview/.test(q)) return interviewQs();
    const project = /traffix|flyrank|fly rank|\bhr\b|document|capstone/.test(q);
    if (/\b(limitations?|weakness(es)?|caveats?)\b/.test(q) && !project) return limitations();
    if (/\b(skills?|tools?|stack|technolog\w*|tech)\b/.test(q) && !project) return tools();
    if (/\b(contact|email|e-mail|reach|linkedin|hire|hiring)\b/.test(q))
      return simple("contact", "Contact", "aziz.messaoud@esprit.tn · github.com/azizmessaoud · linkedin.com/in/azizmessaoud", [
        { label: "Email", url: "mailto:aziz.messaoud@esprit.tn" }, { label: "GitHub", url: "https://github.com/azizmessaoud" }, { label: "LinkedIn", url: "https://www.linkedin.com/in/azizmessaoud/" }]);
    if (/\b(who are you|who is aziz|about you|study|studies|esprit|graduate|school)\b/.test(q))
      return simple("about", "About", "Data Science Engineering student at ESPRIT, Tunisia, expecting to graduate in 2027; looking for a 2027 PFE internship in AI/ML engineering, applied data science or AI research. Works in Arabic, French and English.",
        [{ label: "Live portfolio source (projectx0)", url: "https://github.com/azizmessaoud/projectx0/blob/bd6e84df36f1cf3acb093c5a0f77544012fbc104/client/src/lib/portfolioData.ts" }]);

    const results = retriever.search(input, 2);
    if (!results.length)
      return make({ outcome: "not_verified", intent: "retrieval", title: "Nothing verified", answer: `No verified passage answers that, so I won't guess. ${SUGGEST}`, limitations: ["Missing evidence, not a 'no': the answer may exist outside what this site can show."] });
    const top = results[0].passage;
    const askedWords = new Set(words(input));
    const contradicted = results.some((r) => r.passage.challenges.some((c) => askedWords.has(c)));
    const lead = results.find((r) => r.passage.challenges.some((c) => askedWords.has(c)))?.passage ?? top;
    const rest = results.map((r) => r.passage).filter((p) => p.id !== lead.id);
    const uniq = <T,>(xs: T[], key: (x: T) => string) => xs.filter((x, i) => xs.findIndex((y) => key(y) === key(x)) === i);
    return make({
      outcome: contradicted ? "contradicted" : "supported", intent: "retrieval", title: lead.title,
      answer: (contradicted ? "The evidence disagrees with that premise. " : "") + lead.text + (rest.length ? ` Also relevant: ${rest[0].title}. ${rest[0].text}` : ""),
      evidence: uniq([lead, ...rest].flatMap((p) => p.evidence), (e) => e.url),
      limitations: uniq([lead, ...rest].flatMap((p) => p.limitations), (l) => l),
    });
  }

  return { ask, certs };
}
