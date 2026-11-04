/* The answer engine behind the hero panel and the terminal. Deterministic and browser-only: no backend,
 * no model, no network. Every factual answer carries the specific source that supports it, and four outcomes
 * stay distinct: supported, contradicted (the evidence says the opposite of the question's premise),
 * not_verified (no evidence either way) and error (the question could not be processed). */
import { consoleRecordLine, endpointLine } from "../content/awsRecord";
import type { Corpus, Portfolio } from "../content/schema";
import { LABELS, LABEL_KEYS, PROJECT_NAME, PROOF, type LabelKey } from "../content/labels";
import { isNear } from "../retrieval/fuzzy";
import { createRetriever } from "../retrieval/retriever";
import { createGuard, isInstruction, MIN_COVERAGE } from "./guard";

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
const SUGGEST = "Ask about my projects (TraffiX, FlyRank, the HR prototype), internships, languages, certifications or AWS hosting status, or type help for the commands.";

const AWS_SERVICES: { name: string; re: RegExp }[] = [
  { name: "Amazon Bedrock", re: /\bbedrock\b/i },
  { name: "AWS Lambda", re: /\blambda\b/i },
  { name: "Amazon API Gateway", re: /\bapi gateway\b/i },
  { name: "Amazon S3 or Bedrock Knowledge Bases", re: /\b(s3|knowledge bases?)\b/i },
];
const OTHER_ISSUERS = ["aws", "amazon", "google", "gcp", "cisco", "comptia", "pmi", "red hat", "salesforce", "tensorflow", "hashicorp", "snowflake"];
const ISSUER_ALIAS: Record<string, string> = { azure: "microsoft", oci: "oracle" };
const CERT_WORDS = /certif|credential|badge|diploma|accredit|\bcerts?\b|\bcourses?\b|(?<!machine |deep )\blearning\b|practitioner/i;
const STOP = new Set(["what", "whats", "what's", "is", "are", "the", "a", "an", "do", "does", "you", "your", "aziz", "azizs", "have", "has", "his", "he", "any", "of", "to", "and", "or", "with", "got", "show", "me", "list", "all", "my", "i", "please", "tell", "about", "certified", "in", "certificate", "certification", "certifications", "certifs", "cert", "certs", "credential", "credentials", "cloud", "practitioner"]);
/* Everyday shorthand and the commonest slips, applied before routing and retrieval. */
const SHORTHAND: [RegExp, string][] = [[/\bwhois\b/g, "who is"], [/\b(whats|wats)\b/g, "what is"], [/\bwat\b/g, "what"], [/\bur\b/g, "your"], [/\bu\b/g, "you"], [/\bhe's\b/g, "he is"]];
const normalise = (s: string) => SHORTHAND.reduce((t, [re, to]) => t.replace(re, to), s.toLowerCase());
/** A word of the question matches one of `targets` exactly, as a prefix of 5+ letters, or within the allowed typos. */
const near = (q: string, targets: string[]) =>
  q.split(/[^a-z0-9]+/).some((w) => w.length > 2 && targets.some((t) => w === t || (w.length >= 5 && t.startsWith(w)) || isNear(w, t)));
const words = (s: string) => s.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9+ ]/g, " ").split(" ").filter(Boolean);

export function createAssistant(corpus: Corpus, portfolio: Portfolio) {
  const retriever = createRetriever(corpus);
  const guard = createGuard(corpus, portfolio);
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
        answer: `The site is hosted with AWS Amplify Hosting at ${aws.liveUrl}. ${endpointLine(aws)} ${consoleRecordLine(aws)} Amplify Hosting is the only AWS service recorded as connected.`,
        evidence: [awsStatusEvidence, amplifyEvidence],
        limitations: ["This is the site's own record. Open the URL to check it.", ...(aws.consoleRecord ? [] : ["The Amplify console build record is not captured yet."]), ...aws.planned.map((p) => `${p.name}: planned, not connected.`)],
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
    const line = (c: (typeof certifications)[number]) => `${c.title} · ${c.issuer} · ${c.year}${c.kind === "learning" ? ` (${c.detail})` : ""}`;
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

  function fromPassage(id: string, intent: string): Answer {
    const p = byPassage.get(id)!;
    return make({ outcome: "supported", intent, title: p.title, answer: p.text, evidence: p.evidence, limitations: p.limitations });
  }

  function judgement(): Answer {
    const ev = ["fr-method", "tr-ambulance", "hr-accuracy"].flatMap((id) => (byPassage.get(id)?.evidence ?? []).slice(0, 1));
    return make({
      outcome: "not_verified", intent: "judgement", title: "A judgement or a number this site cannot verify",
      answer: "Whether to hire me, my strengths and salary expectations are not facts this site can prove, so I do not claim them. What the evidence does show is how I work and where my results fall short: each project lists its data, how it was judged, where it fails and who reviews the output. Salary and start dates are not on this site; email me.",
      evidence: ev,
      limitations: ["Opinions about me are yours to form from the evidence, not mine to assert."],
    });
  }

  function projectsOverview(): Answer {
    const ev = ["tr-simulation", "fr-question", "hr-pipeline"].flatMap((id) => (byPassage.get(id)?.evidence ?? []).slice(0, 1));
    const small = portfolio.smallProjects.map((x) => x.title).join(", ");
    return make({
      outcome: "supported", intent: "projects", title: "Projects",
      answer: `Three case studies: TraffiX (a multi-agent traffic-control simulation, team project), the FlyRank capstone (ranking pages for human review) and HR document checks (a prototype on synthetic documents). Also: ${small}. Ask about any of them for its result and its limits.`,
      evidence: ev,
      limitations: ["Each case study ends with where it fails; the team projects name only my part."],
    });
  }


  /* A question that names one project and one aspect of it is answered from that project's own label, never from free retrieval:
   * "Where does FlyRank fail?" must not return TraffiX's limits. Two projects in one question, or none, fall through to retrieval. */
  const PROJECT_WORDS: Record<LabelKey, RegExp> = { traffix: /traffix|ambulance|pedestrian|sumo|junction/, flyrank: /flyrank|fly rank|capstone|precision|random forest/, hr: /\bhr\b|hr prototype|document check|\bocr\b|docling/ };
  const ASPECTS: { key: "fails" | "data" | "evaluation" | "review"; re: RegExp; title: string }[] = [
    { key: "fails", re: /\b(fail\w*|limit\w*|weak\w*|wrong|caveats?|problems?|downsides?|not work\w*|doesn't work|does not work|shortcomings?)\b/, title: "where it fails" },
    { key: "review", re: /\b(review\w*|oversight|approv\w*|who decides|human in the loop)\b|who (checks|decides)/, title: "who reviews the output" },
    { key: "evaluation", re: /\b(evaluat\w*|judged|measured|validat\w*|baseline|how (good|well|accurate)|tested)\b/, title: "how it was judged" },
    { key: "data", re: /\b(data|dataset|data set|trained on|demand)\b/, title: "the data" },
  ];
  function projectAspect(q: string): Answer | null {
    if (/\bleak/.test(q)) return null; /* "data leakage" is its own passage */
    const hit = LABEL_KEYS.filter((k) => PROJECT_WORDS[k].test(q));
    if (hit.length !== 1) return null;
    const aspect = ASPECTS.find((x) => x.re.test(q));
    if (!aspect) return null;
    const key = hit[0]; const lines = LABELS[key][aspect.key];
    return make({
      outcome: "supported", intent: `project-${aspect.key}`, title: `${PROJECT_NAME[key]}: ${aspect.title}`,
      answer: lines.join(" "), evidence: [PROOF[key]],
      limitations: ["This restates the project's own label from its case study; open the case study for the figures behind it."],
    });
  }

  function ask(raw: string): Answer {
    const input = raw.trim().replace(/\s+/g, " ").replace(/^ask\s+/i, "");
    if (!input) return make({ outcome: "error", intent: "invalid", title: "No question", answer: "Type a question first." });
    if (input.length > MAX_QUESTION) return make({ outcome: "error", intent: "invalid", title: "Question too long", answer: `Questions are limited to ${MAX_QUESTION} characters; this one has ${input.length}.` });
    const q = normalise(input);
    if (isInstruction(q))
      return make({ outcome: "not_verified", intent: "instruction", title: "I can't be told what to say", answer: `I answer only from the checked evidence, so I can't change my rules or say something because I'm asked to. ${SUGGEST}`, limitations: ["Every answer here is looked up from the site's checked notes, not written to order."] });
    const project = /traffix|flyrank|fly rank|\bhr\b|document|capstone|ambulance|pedestrian|precision|leakage|ocr/.test(q);

    for (const sv of AWS_SERVICES) if (sv.re.test(q) || (sv.name.includes("Bedrock") && near(q, ["bedrock"])) || (sv.name.includes("Lambda") && near(q, ["lambda"]))) return awsService(sv.name);
    if (/\b(aws|amazon)\b/.test(q) && (CERT_WORDS.test(q) || near(q, ["certification", "certificate", "credential"]))) return certs(input);
    if (/\b(aws|amazon|amplify)\b/.test(q) || /(hosting|hosted|site|website|portfolio).*(deploy|live|status|hosted)|(deploy|live).*(site|website|portfolio)/.test(q) && !/traffix|simulation/.test(q)) return awsHosting();
    if (/\b(why (should|would|do) (we|i) (hire|pick|choose)|hire (you|him|aziz)|strengths?|best at|salary|salaries|pay|paid|expectations?|rate|how much|rating|score)\b/.test(q)) return judgement();
    if (CERT_WORDS.test(q) || near(q, ["certification", "certificate", "credential", "certified"]) || /\b(oracle|microsoft|azure|databricks|nvidia|kaggle|ibm|google|gcp)\b/.test(q)) return certs(input);
    if (near(q, ["interview"])) return interviewQs();
    { const pa = projectAspect(q); if (pa) return pa; }
    if (!project && near(q, ["limitation", "limitations", "weakness", "weaknesses", "caveat"])) return limitations();
    if (!project && (near(q, ["skills", "tools", "stack", "technologies", "technology"]) || /\bskill/.test(q))) return tools();
    if ((near(q, ["contact", "email", "linkedin", "hiring"]) || /\breach (you|him|aziz|out)\b|\bget in touch\b/.test(q)) && !/(email|reach).*(traffix|project)/.test(q))
      return simple("contact", "Contact", "aziz.messaoud@esprit.tn · calendly.com/aziz-messaoud · github.com/azizmessaoud · linkedin.com/in/azizmessaoud", [
        { label: "Email", url: "mailto:aziz.messaoud@esprit.tn" }, { label: "Book a call", url: "https://calendly.com/aziz-messaoud" }, { label: "GitHub", url: "https://github.com/azizmessaoud" }, { label: "LinkedIn", url: "https://www.linkedin.com/in/azizmessaoud/" }]);
    if (!project && /\b(who (is|are)|about (you|aziz|yourself|him)|tell me about|introduce|describe (you|aziz|yourself))\b/.test(q)) return fromPassage("pr-about", "about");
    if (!project && /\bprojects?\b/.test(q) && !/\b(worst|weakest|best|performed|bad|poor|fail)/.test(q)) return projectsOverview();

    const unknown = guard.unknownTerms(q);
    if (unknown.length)
      return make({
        outcome: "not_verified", intent: "retrieval", title: `Nothing verified about ${unknown.map((u) => `“${u}”`).join(", ")}`,
        answer: `Nothing in the checked evidence mentions ${unknown.map((u) => `“${u}”`).join(" or ")}, so I won't guess. ${SUGGEST}`,
        limitations: ["Missing evidence, not a 'no': the answer may exist outside what this site can show."],
      });
    /* a question naming one project is answered from that project's passages (and the general profile), never from another project's */
    const named = LABEL_KEYS.filter((k) => PROJECT_WORDS[k].test(q));
    const scope = named.length === 1 ? { traffix: "traffix", flyrank: "flyrank", hr: "hr-docs" }[named[0]] : undefined;
    /* a question that only names a project ("Tell me about TraffiX") gets that project's overview, not a search */
    if (scope && guard.topicTerms(q).length === 0 && /\b(tell me about|about|what is|what's|what does|describe|explain|overview|summari[sz]e|introduce)\b|^(traffix|flyrank|the hr prototype)\??$/.test(q)) return fromPassage({ traffix: "tr-simulation", flyrank: "fr-question", hr: "hr-pipeline" }[named[0]], "project-overview");
    const found = (scope ? retriever.search(q, 8).filter((r) => r.passage.projectId === scope || r.passage.projectId === "portfolio") : retriever.search(q, 4));
    /* and only by a passage that itself uses the question's topic words: a word found elsewhere in the notes does not make this passage an answer */
    const covers = found.map((r) => ({ r, c: guard.coverage(q, r.passage) }));
    const results = covers.filter((x) => x.c.total === 0 || x.c.covered / x.c.total >= MIN_COVERAGE).map((x) => x.r).slice(0, 2);
    if (found.length && !results.length) {
      const miss = [...new Set(covers[0].c.missing)].map((m) => `“${m}”`).join(", ");
      return make({
        outcome: "not_verified", intent: "retrieval", title: "Nothing verified that answers this",
        answer: `The closest notes don't say anything about ${miss}, so I won't answer as if they did. ${SUGGEST}`,
        limitations: ["Missing evidence, not a 'no': the answer may exist outside what this site can show."],
      });
    }
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
