/* The answer engine behind the hero panel and the terminal. Deterministic and browser-only: no backend, no model,
 * no network. Every factual answer carries the specific source that supports it. Outcomes stay distinct:
 *   supported      the evidence answers the question
 *   contradicted   the evidence says the opposite of the question's premise
 *   related        the closest evidence found, which may not answer the question
 *   not_verified   nothing here proves it either way
 *   out_of_scope   not a question about my work (an instruction, a task, small talk with a request)
 *   info           the interface talking (greeting, "what do you mean?"), no claim at all
 *   error          the input could not be processed */
import type { Corpus, CorpusPassage, Portfolio } from "../content/schema";
import { LABELS, LABEL_KEYS, type LabelKey } from "../content/labels";
import { isNear } from "../retrieval/fuzzy";
import { createRetriever } from "../retrieval/retriever";
import { tokenize } from "../retrieval/tokenize";
import { AWS_SERVICES, ENTITIES, escapeRe, FILLER, GENERIC, OTHER_ISSUERS, PLANNED_ONLY, PROJECT_WORDS, re, UNVERIFIED_TECH } from "./intents";
import { normalise, smalltalk, stripGreeting, type Lang } from "./lexicon";

export type Outcome = "supported" | "contradicted" | "related" | "not_verified" | "out_of_scope" | "info" | "error";
export interface Evidence { label: string; url: string }
export interface Answer {
  outcome: Outcome;
  intent: string;
  title: string;
  answer: string;
  evidence: Evidence[];
  limitations: string[];
  /** Ids of the passages this answer was built from, so tests can check the route and not only the wording. */
  passageIds: string[];
  /** A compound question answered in parts, each with its own evidence and limits. */
  parts?: Answer[];
  /** What the next question can refer to ("and its limits?", "why?", "the source"). Pass it back into `ask`. */
  next?: Context;
  lang?: Lang;
}
export interface Context { project?: LabelKey; intent: string; passageIds: string[]; evidence: Evidence[]; shown: string[] }

export const MAX_QUESTION = 200;
const SUGGESTIONS = ["What did Aziz personally build in TraffiX?", "Did TraffiX make ambulances faster?", "Where did he do internships?", "What is the AWS hosting status?", "What are his certifications?"];
const SUGGEST = "Ask about my projects (TraffiX, FlyRank, the HR prototype), internships, languages, certifications or AWS hosting status, or type help for the commands.";
const REPO = "https://github.com/azizmessaoud/aws-superpower-portfolio/blob/main";
const PROJECT_OF: [string, LabelKey][] = [["tr-", "traffix"], ["fr-", "flyrank"], ["hr-", "hr"], ["al-", "alia"]];
const projectOf = (ids: string[]): LabelKey | undefined => PROJECT_OF.find(([p]) => ids.some((i) => i.startsWith(p)))?.[1];
const PROJECT_NAME: Record<LabelKey, string> = { traffix: "TraffiX", flyrank: "FlyRank", hr: "HR document checks", alia: "ALIA" };
const ISSUER_ALIAS: Record<string, string> = { azure: "microsoft", oci: "oracle" };
const CERT_WORDS = /certif|credential|badge|diploma|accredit|\bcerts?\b|\bcourses?\b|practitioner/;
const STOP = new Set(["what", "whats", "what's", "is", "are", "the", "a", "an", "do", "does", "you", "your", "aziz", "azizs", "have", "has", "his", "he", "any", "of", "to", "and", "or", "with", "got", "show", "me", "list", "all", "my", "i", "please", "tell", "about", "certified", "in", "certificate", "certification", "certifications", "certifs", "cert", "certs", "credential", "credentials", "cloud", "practitioner", "badges", "badge", "cloud"]);
const words = (s: string) => s.toLowerCase().replace(/'s\b/g, "").replace(/[^a-z0-9+ ]/g, " ").split(" ").filter(Boolean);
const near = (q: string, targets: string[]) =>
  q.split(/[^a-z0-9]+/).some((w) => w.length > 2 && targets.some((t) => w === t || (w.length >= 5 && t.startsWith(w)) || isNear(w, t)));
const uniq = <T,>(xs: T[], key: (x: T) => string) => xs.filter((x, i) => xs.findIndex((y) => key(y) === key(x)) === i);

export function createAssistant(corpus: Corpus, portfolio: Portfolio) {
  const retriever = createRetriever(corpus);
  const { aws, certifications, skills, interview, glossary } = portfolio;
  const byPassage = new Map(corpus.passages.map((p) => [p.id, p]));
  const P = (id: string) => byPassage.get(id)!;
  const awsStatusEvidence: Evidence = { label: "aws-status.yaml (this site's AWS record)", url: `${REPO}/content/aws-status.yaml` };
  const amplifyEvidence: Evidence = { label: "amplify.yml @ 0fa4d70", url: aws.verified[0].href };
  const pkgEvidence: Evidence = { label: "package.json @ 0fa4d70", url: aws.verified[1].href };
  const readmeEvidence: Evidence = { label: "README: how this site works", url: `${REPO}/README.md` };
  const engineEvidence: Evidence = { label: "src/assistant/answer.ts (the answer engine)", url: `${REPO}/src/assistant/answer.ts` };
  const contactEvidence: Evidence[] = [{ label: "Email", url: "mailto:aziz.messaoud@esprit.tn" }, { label: "GitHub", url: "https://github.com/azizmessaoud" }, { label: "LinkedIn", url: "https://www.linkedin.com/in/azizmessaoud/" }];
  const repoEvidence: Evidence = { label: "Source code of this site", url: "https://github.com/azizmessaoud/aws-superpower-portfolio" };

  const make = (a: Partial<Answer> & Pick<Answer, "outcome" | "intent" | "title" | "answer">): Answer => ({ evidence: [], limitations: [], passageIds: [], ...a });
  const ctxOf = (a: Answer, prev?: Context): Context => ({
    project: projectOf(a.passageIds) ?? (a.intent === "limitations" ? prev?.project : undefined),
    intent: a.intent, passageIds: a.passageIds, evidence: a.evidence, shown: uniq([...(prev?.shown ?? []), ...a.passageIds], (x) => x),
  });

  /* ───────── AWS ───────── */
  function awsService(name: string): Answer {
    const hit = aws.connected.find((c) => c.name.toLowerCase().includes(name.toLowerCase().split(" ").pop()!));
    if (hit)
      return make({ outcome: "supported", intent: "aws-service", title: `${hit.name}: connected`, answer: `${hit.name} is recorded as connected.`, evidence: [{ label: `${hit.name} evidence`, url: hit.evidence }, awsStatusEvidence], limitations: ["Only what the linked evidence shows is claimed."] });
    const key = name.toLowerCase().split(/ or |, /)[0].replace("amazon ", "").replace("aws ", "");
    const planned = aws.planned.find((p) => p.name.toLowerCase().includes(key));
    return make({
      outcome: "not_verified", intent: "aws-service", title: `${name}: not verified`,
      answer: `Not verified. Nothing in this repository shows ${name} connected to this site. ${planned ? `It is listed as planned only: ${planned.note}` : "It is not listed anywhere in my AWS record."} The working answer engine is a keyword retriever that runs in your browser.`,
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
      answer: "Deployment is not verified. An Amplify build specification exists (npm ci, npm run build, serve dist), but a configuration file does not prove a deployment, and no live URL or build record is recorded yet. Prepared, not deployed.",
      evidence: [amplifyEvidence, awsStatusEvidence],
      limitations: aws.planned.map((p) => `${p.name}: planned, not connected.`),
    });
  }
  function awsCost(): Answer {
    return make({
      outcome: "not_verified", intent: "aws-cost", title: "AWS cost: nothing is running yet",
      answer: aws.deployed ? "A deployment is recorded; its cost is not reported on this site. See the cost and safety rules on the AWS section." : "No AWS resource is recorded as running, so there is no hosting cost to report. The cost and safety rules (budget alert, throttling, no credentials in the browser) are listed on the AWS section.",
      evidence: [awsStatusEvidence], limitations: aws.costSafety.slice(0, 2),
    });
  }
  function architecture(): Answer {
    return make({
      outcome: "supported", intent: "architecture", title: "Architecture: a static site, no backend",
      answer: `${aws.verified[1].text} Answers are found by a keyword search that runs in your browser: no server, no model, no network call.`,
      evidence: [pkgEvidence, engineEvidence], limitations: [`Planned, not built: ${aws.planned.filter((p) => !p.name.includes("Amplify")).map((p) => p.name).join(", ")}.`],
    });
  }
  function cloud(): Answer {
    const cl = certifications.filter((c) => /OCI|Azure|Oracle Cloud/i.test(c.title + c.detail));
    return make({
      outcome: "supported", intent: "cloud", title: "Cloud: what is verified",
      answer: `Credentials: ${cl.map((c) => `${c.title} (${c.issuer}, ${c.year})`).join("; ")}. ${aws.deployed ? `Hosted on AWS: ${aws.liveUrl}.` : "No AWS deployment is verified yet, and no AWS service is connected."}`,
      evidence: [...cl.map((c) => ({ label: `${c.title} · ${c.issuer}`, url: c.href })), awsStatusEvidence],
      limitations: ["Fundamentals and associate-level credentials, not hands-on production experience.", "No cloud deployment of my projects is verified."],
    });
  }

  /* ───────── certifications ───────── */
  function certs(query: string): Answer {
    const q = query.toLowerCase();
    const ws = words(query).map((w) => ISSUER_ALIAS[w] ?? w);
    const issuers = [...new Set(certifications.map((c) => c.issuer.toLowerCase()))];
    const asked = ws.filter((w) => w.length >= 3 && !STOP.has(w) && issuers.some((i) => i.includes(w)));
    const missing = OTHER_ISSUERS.filter((i) => new RegExp(`\\b${escapeRe(i)}\\b`).test(q) && !issuers.some((x) => x.includes(i)));
    const shown = asked.length ? certifications.filter((c) => asked.some((w) => c.issuer.toLowerCase().includes(w))) : certifications;
    const line = (c: (typeof certifications)[number]) => `${c.title} · ${c.issuer} · ${c.year}${c.kind === "learning" ? ` (${c.detail})` : ""}`;
    const evidence = shown.map((c) => ({ label: line(c), url: c.href }));
    if (missing.length && !asked.length)
      return make({
        outcome: "not_verified", intent: "certifications", title: "Certification: not verified",
        answer: `I can't verify a ${missing.map((m) => m.toUpperCase()).join(" / ")} credential: none is in my list, so none is claimed. What I can verify: ${certifications.filter((c) => c.kind === "main").map((c) => c.title).join(", ")}, plus ${certifications.filter((c) => c.kind === "learning").length} shorter courses.`,
        evidence, limitations: ["Each credential links to its issuer's own page; open it to check."],
      });
    return make({
      outcome: "supported", intent: "certifications", title: asked.length ? `Credentials from ${[...new Set(shown.map((c) => c.issuer))].join(", ")}` : "Certifications",
      answer: shown.map(line).join("; ") + ".", evidence,
      limitations: ["Each link is the issuer's own verification page; I have not re-checked them since copying them from my earlier portfolio on 29 Oct 2026."],
    });
  }

  /* ───────── tools ───────── */
  const toolIndex = (() => {
    const m = new Map<string, { name: string; where?: string; href?: string; kind: "used" | "listed" }>();
    const alias: Record<string, string[]> = { "scikit-learn": ["sklearn", "scikit learn", "scikit"], pytorch: ["torch"], tensorflow: [], "react + typescript": ["react", "typescript"], "ocr / document parsing": ["document parsing"], "multi-agent systems": ["multi agent", "multi-agent"], llms: ["llm", "large language model", "large language models"], nlp: ["natural language processing"], "data visualization": ["data viz", "dataviz", "visualization"] };
    for (const d of skills) {
      for (const chip of d.chips) {
        const rec = { name: chip, where: d.where, href: d.href, kind: (d.icon === "toolkit" ? "listed" : "used") as "used" | "listed" };
        for (const n of [chip.toLowerCase(), ...(alias[chip.toLowerCase()] ?? [])]) if (n.length >= 3 && !m.has(n)) m.set(n, rec);
      }
    }
    for (const sp of portfolio.smallProjects) for (const t of sp.tags) { const n = t.toLowerCase(); if (!m.has(n)) m.set(n, { name: t, where: sp.title, href: sp.href, kind: "used" }); }
    return m;
  })();
  const toolNames = [...toolIndex.keys()].sort((a, b) => b.length - a.length);
  function toolLookup(q: string): Answer | null {
    const levelAsk = /\b(level|good|best|expert|proficien\w*|skilled?|master\w*|how well|rate|rating|years)\b/.test(q);
    const hit = toolNames.find((n) => new RegExp(`(^|[^a-z0-9+#.])${escapeRe(n)}($|[^a-z0-9+#])`).test(q));
    const unknown = UNVERIFIED_TECH.find((n) => new RegExp(`(^|[^a-z0-9+#.])${escapeRe(n)}($|[^a-z0-9+#])`).test(q));
    const planned = PLANNED_ONLY.find((n) => new RegExp(`\\b${n}\\b`).test(q));
    if (hit && !unknown) {
      const t = toolIndex.get(hit)!;
      const limits = ["No skill level or score is claimed anywhere on this site."];
      if (t.kind === "listed") limits.unshift("Listed on my portfolio but not demonstrated on this page: there is no project here that shows it.");
      return make({
        outcome: "supported", intent: "tool", title: `${t.name}: ${t.kind === "used" ? "used" : "listed, not demonstrated"}`,
        answer: t.kind === "used" ? `Yes: ${t.name} appears in ${t.where}.${levelAsk ? " I do not rate my own level, so I can only point to where I used it." : ""}` : `${t.name} is in my toolkit as listed on my earlier portfolio, but this site does not demonstrate it.${levelAsk ? " I do not rate my own level." : ""}`,
        evidence: t.href ? [{ label: `${t.name} · ${t.where}`, url: t.href }] : [{ label: "Skills list in my earlier portfolio", url: "https://github.com/azizmessaoud/projectx0/blob/bd6e84df36f1cf3acb093c5a0f77544012fbc104/client/src/lib/portfolioData.ts" }], limitations: limits,
      });
    }
    if (planned) return make({ outcome: "not_verified", intent: "tool", title: `${planned}: planned, not built`, answer: `${planned} appears only in the planned full-stack mode of the HR prototype; it is not built.`, evidence: P("hr-runtime").evidence, passageIds: ["hr-runtime"], limitations: ["Planned is not used."] });
    if (unknown) return make({ outcome: "not_verified", intent: "tool", title: `${unknown}: not verified`, answer: `Not verified. ${unknown} does not appear in my verified tools or projects, so I do not claim it.`, evidence: [], limitations: ["Not verified is not proof of absence: it means this site's evidence does not show it."] });
    return null;
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

  /* ───────── fixed answers ───────── */
  const fromPassage = (id: string, intent: string, extra: Partial<Answer> = {}): Answer => {
    const p = P(id);
    return make({ outcome: "supported", intent, title: p.title, answer: p.text, evidence: p.evidence, limitations: p.limitations, passageIds: [id], ...extra });
  };
  function interviewQs(): Answer {
    const qs = interview.map((i) => ({ ...i, p: byPassage.get(i.passage)! })).filter((i) => i.p);
    return make({
      outcome: "supported", intent: "interview", title: "What to ask me in an interview",
      answer: qs.map((q, i) => `${i + 1}. ${q.question}`).join(" "),
      evidence: uniq(qs.map((q) => q.p.evidence[0]).filter(Boolean), (e) => e.url), passageIds: qs.map((q) => q.passage),
      limitations: ["These are suggested questions, not claims. Each links to the passage that holds the evidence."],
    });
  }
  function limitations(project?: LabelKey): Answer {
    if (project) {
      const ids = project === "traffix" ? ["tr-limits", "tr-ambulance"] : project === "flyrank" ? ["fr-p50"] : project === "alia" ? ["al-limits"] : ["hr-accuracy", "hr-runtime"];
      return make({ outcome: "supported", intent: "limitations", title: `Limits: ${PROJECT_NAME[project]}`, answer: LABELS[project].fails.join(" "), evidence: uniq(ids.flatMap((i) => P(i).evidence.slice(0, 1)), (e) => e.url), passageIds: ids, limitations: [] });
    }
    const lim = LABEL_KEYS.flatMap((k) => LABELS[k].fails.slice(0, 2).map((f) => `${PROJECT_NAME[k]}: ${f}`));
    const ids = ["tr-limits", "fr-p50", "hr-accuracy"];
    return make({ outcome: "supported", intent: "limitations", title: "Limits of the results", answer: "Every result here has limits next to it. The main ones are listed below; ask about one project for its full list.", evidence: ids.flatMap((i) => P(i).evidence.slice(0, 1)), passageIds: ids, limitations: lim });
  }
  function sourcesList(): Answer {
    const ids = ["tr-simulation", "tr-ambulance", "fr-question", "fr-p50", "hr-pipeline"];
    return make({
      outcome: "supported", intent: "sources", title: "Where the evidence lives",
      answer: "Each result links to the exact file and commit it came from: the TraffiX README and validation report, the FlyRank capstone report and the w05 notebook, and the HR prototype README. These are the primary sources.",
      evidence: uniq(ids.flatMap((i) => P(i).evidence.slice(0, 1)), (e) => e.url), passageIds: ids, limitations: ["The FlyRank warehouse is gated, so its notebook cannot be fully re-run in public."],
    });
  }
  function deploymentOverview(): Answer {
    const site = awsHosting();
    const sim = make({ outcome: "contradicted", intent: "retrieval", title: P("tr-simulation").title, answer: P("tr-simulation").text, evidence: P("tr-simulation").evidence, limitations: P("tr-simulation").limitations, passageIds: ["tr-simulation"] });
    return make({ outcome: "not_verified", intent: "compound", title: `${site.title} + ${sim.title}`, answer: `Two things could be meant. 1) This site: ${site.answer} 2) TraffiX: ${sim.answer}`, evidence: uniq([...site.evidence, ...sim.evidence], (e) => e.url), limitations: uniq([...site.limitations, ...sim.limitations], (l) => l), passageIds: ["tr-simulation"], parts: [site, sim] });
  }
  function contact(): Answer {
    return make({ outcome: "supported", intent: "contact", title: "Contact", answer: "aziz.messaoud@esprit.tn · github.com/azizmessaoud · linkedin.com/in/azizmessaoud. The source code of this site is public: github.com/azizmessaoud/aws-superpower-portfolio.", evidence: [...contactEvidence, repoEvidence], limitations: [] });
  }
  function privacy(): Answer {
    return make({ outcome: "not_verified", intent: "privacy", title: "Not published on this site", answer: "That is not published here, so I will not guess or look it up. What I do publish is my email, GitHub and LinkedIn.", evidence: contactEvidence, limitations: ["Personal details are shared by email, if at all."] });
  }
  function judgement(): Answer {
    const ids = ["fr-method", "tr-ambulance", "hr-accuracy"];
    return make({
      outcome: "not_verified", intent: "judgement", title: "A judgement or a number this site cannot verify",
      answer: "Whether to hire me, my strengths and salary expectations are not facts this site can prove, so I do not claim them. What the evidence does show is how I work and where my results fall short: each project lists its data, how it was judged, where it fails and who reviews the output. Salary and start dates are not on this site; email me.",
      evidence: ids.flatMap((i) => P(i).evidence.slice(0, 1)), passageIds: ids, limitations: ["Opinions about me are yours to form from the evidence, not mine to assert."],
    });
  }
  function projectsOverview(): Answer {
    const ids = ["tr-simulation", "fr-question", "hr-pipeline", "al-overview"];
    const small = portfolio.smallProjects.map((x) => x.title).join(", ");
    return make({
      outcome: "supported", intent: "projects", title: "Projects",
      answer: `Four case studies: TraffiX (a multi-agent traffic-control simulation, team project), the FlyRank capstone (ranking pages for human review), HR document checks (a prototype on synthetic documents) and ALIA (a team prototype of a practice avatar, under NDA). Also: ${small}. Ask about any of them for its result and its limits.`,
      evidence: ids.flatMap((i) => P(i).evidence.slice(0, 1)), passageIds: ids, limitations: ["Each case study ends with where it fails; the team projects name only my part."],
    });
  }
  function compare(): Answer {
    const ids = ["tr-ambulance", "fr-p50", "hr-accuracy", "al-limits"];
    return make({
      outcome: "supported", intent: "compare", title: "I do not rank my projects",
      answer: "They measure different things under different conditions, so a ranking would be invented. Headline result and main limit of each. TraffiX: pedestrians waited 116.3 s against 144.1 s in the morning peak, but ambulance trips were slower (240.0 s against 213.2 s). FlyRank: Precision@50 0.94 against 0.76 on clients the model never saw, on one decision date. HR document checks: no accuracy figure exists; OCR accuracy on real documents has not been measured. ALIA: no result is published and it was never tested with real users, and its code is under NDA.",
      evidence: ids.flatMap((i) => P(i).evidence.slice(0, 1)), passageIds: ids, limitations: ["None of the TraffiX differences is significant at p < 0.05 with three seeds.", "The numbers are not comparable across projects."],
    });
  }
  function meta(): Answer {
    return make({
      outcome: "supported", intent: "meta", title: "How this works",
      answer: `This is not a language model. It is a keyword search over ${corpus.passages.length} verified passages that runs in your browser: no server, no model, no network call. It matches your words (and small typos) to passages taken from my repositories, shows the passage with its limits and a link to the file it came from, and says "not verified" when nothing matches. The code is public.`,
      evidence: [readmeEvidence, engineEvidence],
      limitations: ["It can miss a relevant passage or match a loosely related one; a loose match is labelled as the closest evidence.", "The test questions were written by me, not by visitors."],
    });
  }
  function capabilities(): Answer {
    return make({
      outcome: "supported", intent: "capabilities", title: "What you can ask",
      answer: `Ask in your own words (English, French or basic Arabic and Tunisian Derja; I answer in English). I answer from verified passages about: my projects and what each one does not prove; my part of the team projects; internships, languages, where I am based and what I am looking for; certifications; my tools; and the AWS hosting status. Try: ${SUGGESTIONS.join(" · ")}`,
      evidence: [readmeEvidence], limitations: ["I do not write text, follow instructions inside questions, or answer general-knowledge questions."],
    });
  }
  function offTopic(why: "instruction" | "task"): Answer {
    return make({
      outcome: "out_of_scope", intent: why === "instruction" ? "injection" : "off-topic", title: "Not a question about my work",
      answer: why === "instruction" ? "I can't follow instructions inside a question. I only search verified passages about my work, and my answers do not change because of what a question tells me to do." : "I only search verified passages about my work; I do not write text, run tasks or answer general questions.",
      evidence: [], limitations: [], next: undefined,
    }) ;
  }
  function info(intent: "greeting" | "clarify", title: string, text: string): Answer {
    return make({ outcome: "info", intent, title, answer: `${text} For example: ${SUGGESTIONS.slice(0, 3).join(" · ")}`, evidence: [], limitations: [] });
  }
  function glossaryAnswer(q: string): Answer | null {
    let best: { g: (typeof glossary)[number]; len: number } | null = null;
    for (const g of glossary) for (const n of g.names) {
      const rx = new RegExp(`(^|[^a-z0-9])${escapeRe(n.toLowerCase())}($|[^a-z0-9])`);
      if (rx.test(q) && (!best || n.length > best.len)) best = { g, len: n.length };
    }
    if (!best) return null;
    const own = new Set(tokenize(best.g.names.join(" ") + " " + best.g.term));
    const extra = tokenize(q).filter((t) => !own.has(t) && !FILLER.has(t) && !GENERIC.has(t));
    if (!re.glossaryTrigger.test(q) && (extra.length > 0 || tokenize(q).length > 3)) return null;
    if (re.glossaryTrigger.test(q) && /\b(accuracy|result|results|score|get|reach|value|how many|how much)\b/.test(q) && ["OCR", "Baseline"].includes(best.g.term) && extra.length > 0) return null;
    const p = P(best.g.passage);
    return make({
      outcome: "supported", intent: "glossary", title: `${best.g.term}: what it means`,
      answer: `${best.g.definition} In my work: ${p.title}. ${p.text.split(/(?<=\.)\s/)[0]}`,
      evidence: p.evidence, passageIds: [best.g.passage], limitations: ["The definition is general knowledge, not a claim about me; the evidence link shows where the term appears in my work.", ...p.limitations],
    });
  }
  function entityAnswer(q: string): Answer | null {
    const hit = ENTITIES.find((e) => e.re.test(q));
    if (!hit) return null;
    const rest = tokenize(q).filter((t) => !FILLER.has(t) && !hit.re.test(t) && !ENTITIES.some((e) => e.re.test(t)));
    if (rest.length > 0) return null;
    const ps = hit.passages.map(P);
    return make({
      outcome: "supported", intent: "entity", title: hit.title, answer: `${ps.map((p) => p.text).join(" ")} Ask about its result, its limits or my part.`,
      evidence: uniq(ps.flatMap((p) => p.evidence), (e) => e.url), passageIds: hit.passages, limitations: uniq(ps.flatMap((p) => p.limitations), (l) => l),
    });
  }

  /* ───────── follow-ups ───────── */
  function followUp(q: string, ctx?: Context): Answer | null {
    const ask = (which: string) => info("clarify", "Which one do you mean?", `${which} Name a project: TraffiX, FlyRank or HR document checks.`);
    if (re.limitsFollow.test(q)) return ctx?.project ? limitations(ctx.project) : re.limitsPronoun.test(q) && !ctx ? ask("I don't have an earlier answer to refer to.") : limitations();
    if (re.whyFollow.test(q)) {
      if (!ctx?.passageIds.length) return ask("I don't have an earlier answer to explain.");
      const p = P(ctx.passageIds[0]);
      return make({ outcome: "supported", intent: "why", title: `More on: ${p.title}`, answer: `${p.context} ${p.text}`, evidence: p.evidence, passageIds: [p.id], limitations: p.limitations });
    }
    if (re.sourceFollow.test(q) && tokenize(q).length <= 6 && !/\b(source code|github)\b/.test(q)) {
      if (!ctx?.evidence.length) return ask("I don't have an earlier answer to cite.");
      return make({ outcome: "supported", intent: "source", title: "Sources for the last answer", answer: "These are the exact files the last answer came from. Each link opens the file at the commit I checked.", evidence: ctx.evidence, passageIds: ctx.passageIds, limitations: [] });
    }
    if (re.moreAsk.test(q)) {
      if (!ctx?.project) return info("clarify", "Tell me a bit more", "I need something to go on.");
      const next = corpus.passages.find((p) => projectOf([p.id]) === ctx.project && !ctx.shown.includes(p.id));
      if (!next) return make({ outcome: "info", intent: "clarify", title: "That is all I have on it", answer: `I have shown every verified passage I hold on ${PROJECT_NAME[ctx.project]}. Ask about another project or about its limits.`, passageIds: [] });
      return fromPassage(next.id, "more");
    }
    if (re.otherFollow.test(q)) return ask("I'm not sure which one you mean.");
    return null;
  }

  /* ───────── premise check: the question assumes something the evidence contradicts ───────── */
  function premise(q: string): Answer | null {
    if (!PROJECT_WORDS.test(q)) return null;
    const asked = new Set(words(q));
    const content = new Set(tokenize(q).filter((t) => !GENERIC.has(t)));
    for (const p of corpus.passages) {
      if (!p.challenges.some((c) => asked.has(c))) continue;
      const tags = new Set(tokenize(p.tags.join(" ")));
      if (![...content].some((t) => tags.has(t) && !p.challenges.some((c) => tokenize(c).includes(t)))) continue;
      return make({ outcome: "contradicted", intent: "retrieval", title: p.title, answer: `The evidence disagrees with that premise. ${p.text}`, evidence: p.evidence, limitations: p.limitations, passageIds: [p.id] });
    }
    return null;
  }

  /* ───────── profile questions: who, studies, internships, clubs, languages, where ───────── */
  function profile(q: string): Answer | null {
    if (re.cv.test(q))
      return make({ outcome: "not_verified", intent: "cv", title: "No CV is published on this site", answer: "I do not publish a downloadable CV here. My internships and studies are summarised in the profile; email me and I can send details.", evidence: [...P("pr-experience").evidence, ...contactEvidence.slice(0, 1)], passageIds: ["pr-experience"], limitations: ["Dates and titles are my own account, copied from my earlier portfolio."] });
    if (re.team.test(q)) return fromPassage("tr-role", "team", { limitations: [...P("tr-role").limitations, "TraffiX is the only project documented here as a team project; ask about each of the others for its own scope."] });
    const noQualifier = !re.seeking.test(q) && !/\bwhat (kind|sort) of\b/.test(q);
    if (re.experience.test(q) && noQualifier) return fromPassage("pr-experience", "profile");
    if (re.volunteer.test(q)) return fromPassage("pr-volunteering", "profile");
    if (re.spoken.test(q) && !/\b(programming|code|coding|stack)\b/.test(q)) return fromPassage("pr-languages", "profile");
    if (re.edu.test(q) || re.seeking.test(q) || /\binternship\b/.test(q)) return fromPassage("pr-about", "profile");
    if (re.location.test(q)) return fromPassage("pr-location", "profile");
    return null;
  }

  /* ───────── retrieval with a relevance gate ───────── */
  function retrieve(q: string): Answer {
    const info2 = retriever.inspect(q, 4);
    const want = ENTITIES.find((e) => e.key !== "esprit" && e.re.test(q))?.key;
    const projectId = want === "flyrank" ? "flyrank" : want === "hr" ? "hr-docs" : want === "alia" ? "alia" : want ? "traffix" : undefined;
    if (projectId) {
      const first = info2.results.filter((r) => r.passage.projectId === projectId);
      if (first.length) info2.results.splice(0, info2.results.length, ...first, ...info2.results.filter((r) => r.passage.projectId !== projectId));
    }
    info2.results.splice(2);
    const content = info2.typed.filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t));
    const nums = q.match(/\d+(?:\.\d+)?/g) ?? [];
    const numHit = !!info2.results[0] && nums.some((n) => n.length >= 2 && info2.results[0].passage.text.includes(n));
    if (!content.length && !numHit) return info("clarify", "Tell me a bit more", "I need something to go on.");
    if (!info2.results.length)
      return make({ outcome: "not_verified", intent: "retrieval", title: "Nothing verified", answer: `No verified passage answers that, so I won't guess. ${SUGGEST}`, limitations: ["Missing evidence, not a 'no': the answer may exist outside what this site can show."] });
    const matched = info2.matched.filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t));
    const rare = info2.rare.filter((t) => !GENERIC.has(t) && !/^\d+$/.test(t));
    /* a number in the question that the top passage also contains (0.94, 240.0) is strong evidence of the same topic */
    const m = matched.length + (numHit ? 1 : 0), rr = rare.length + (numHit ? 1 : 0);
    const covN = Math.min(1, m / Math.max(1, content.length + (numHit ? 1 : 0)));
    const strong = rr >= 1 && (covN >= 0.75 || (m >= 2 && covN >= (content.length >= 4 ? 0.3 : 0.5))) || (rr >= 2 && covN >= 0.3);
    const weak = !strong && covN >= 0.5 && info2.results[0].score >= 3 && (m >= 2 || (content.length <= 2 && covN === 1));
    if (!strong && !weak)
      return make({ outcome: "not_verified", intent: "retrieval", title: "Nothing verified", answer: `No verified passage answers that, so I won't guess. ${SUGGEST}`, limitations: ["Missing evidence, not a 'no': the answer may exist outside what this site can show."] });
    const results = info2.results;
    const asked = new Set(words(q));
    const contradicted = strong && PROJECT_WORDS.test(q) && results.some((r) => r.passage.challenges.some((c) => asked.has(c)));
    const lead = (contradicted ? results.find((r) => r.passage.challenges.some((c) => asked.has(c)))!.passage : results[0].passage) as CorpusPassage;
    const rest = results.map((r) => r.passage).filter((p) => p.id !== lead.id);
    return make({
      outcome: contradicted ? "contradicted" : strong ? "supported" : "related", intent: "retrieval", title: lead.title, passageIds: [lead.id, ...rest.map((p) => p.id)],
      answer: (contradicted ? "The evidence disagrees with that premise. " : strong ? "" : "Closest evidence I have, which may not answer your question: ") + lead.text + (strong && rest.length ? ` Also relevant: ${rest[0].title}. ${rest[0].text}` : ""),
      evidence: uniq((strong ? [lead, ...rest] : [lead]).flatMap((p) => p.evidence), (e) => e.url),
      limitations: uniq((strong ? [lead, ...rest] : [lead]).flatMap((p) => p.limitations), (l) => l),
    });
  }

  /* ───────── the router: one fragment ───────── */
  function route(q: string, original: string, ctx?: Context): Answer {
    const st = smalltalk(q);
    if (st) return info("greeting", st === "hello" ? "Hello" : st === "bye" ? "Goodbye" : "You're welcome", st === "hello" ? "Hello. I answer questions about my projects and their evidence." : st === "bye" ? "Goodbye. The links in each answer stay open if you want to check anything." : "You're welcome.");
    if (!/[a-z0-9؀-ۿ]/i.test(q)) return info("clarify", "Tell me a bit more", "I could not read a question there.");
    if (re.hardInjection.test(q)) return offTopic("instruction");
    if (re.offTopic.test(q)) return offTopic("task");
    const follow = followUp(q, ctx);
    if (follow) return follow;
    if (re.privacy.test(q)) return privacy();
    for (const sv of AWS_SERVICES) if (sv.re.test(q) || (sv.name.includes("Bedrock") && near(q, ["bedrock"])) || (sv.name.includes("Lambda") && near(q, ["lambda"]))) return awsService(sv.name);
    if (re.awsWords.test(q) && (CERT_WORDS.test(q) || near(q, ["certification", "certificate", "credential"]))) return certs(original);
    if (re.awsWords.test(q) || (re.hostingStatus.test(q) && !/traffix|simulation|flyrank/.test(q))) return re.cost.test(q) ? awsCost() : awsHosting();
    if (re.cost.test(q) && /\b(hosting|host|site|website|cloud)\b/.test(q)) return awsCost();
    if (re.meta.test(q)) return meta();
    if (re.backend.test(q) && /\b(is there|does it|do you have|have a|any)\b/.test(q) && !PROJECT_WORDS.test(q)) return architecture();
    if (re.meta.test(q)) return meta();
    if (re.interview.test(q) || near(q, ["interview"])) return interviewQs();
    if (re.capabilities.test(q)) return capabilities();
    if (re.judgement.test(q)) return judgement();
    const certExplicit = /certif|credential|badge|diploma|accredit/.test(q);
    if ((CERT_WORDS.test(q) && (certExplicit || !PROJECT_WORDS.test(q))) || near(q, ["certification", "certificate", "credential", "certified"]) || /\b(oracle|microsoft|azure|databricks|nvidia|kaggle|ibm|google|gcp)\b/.test(q)) return certs(original);
    if (re.softInjection.test(q)) return offTopic("instruction");
    if (/\b(deployed|deployment|in production|go live|went live|gone live)\b/.test(q) && !PROJECT_WORDS.test(q) && !re.awsWords.test(q)) return deploymentOverview();
    if (re.interview.test(q) || near(q, ["interview"])) return interviewQs();
    const g = glossaryAnswer(q);
    if (g) return g;
    const project = PROJECT_WORDS.test(q);
    const two = ENTITIES.filter((e) => e.key !== "esprit" && e.key !== "sumo" && e.re.test(q)).length >= 2;
    if (re.bestTool.test(q)) return make({ ...tools(), intent: "tools", title: "Tools, and where I used them", limitations: ["I do not rank my own tools or rate my level: no skill levels or scores are claimed on this site.", ...tools().limitations] });
    if (re.compare.test(q) && !re.weakest.test(q) && (two || /\b(project|projects|work|one|result|results|thing|proudest|compare|comparison|versus|vs)\b/.test(q))) return compare();
    if (re.weakest.test(q) && !project) return fromPassage("portfolio-weakest", "weakest");
    const pr = premise(q);
    if (pr) return pr;
    const key = ENTITIES.find((e) => e.key !== "esprit" && e.re.test(q))?.key;
    const pk: LabelKey | undefined = key === "flyrank" ? "flyrank" : key === "hr" ? "hr" : key === "alia" ? "alia" : key ? "traffix" : undefined;
    if (pk && re.weakest.test(q)) return limitations(pk);
    if (pk === "traffix" && re.roleAsk.test(q)) return fromPassage("tr-role", "role");
    if (pk === "alia" && re.roleAsk.test(q)) return fromPassage("al-role", "role");
    if (pk && re.resultAsk.test(q) && !re.roleAsk.test(q)) return fromPassage(pk === "flyrank" ? "fr-p50" : pk === "hr" ? "hr-accuracy" : pk === "alia" ? "al-limits" : "tr-mixed", "result");
    if (!project) { const t = toolLookup(q); if (t) return t; }
    if (!project && re.cloud.test(q)) return cloud();
    if (!project && (near(q, ["limitation", "limitations", "weakness", "weaknesses", "caveat"]) || re.limitations.test(q))) return limitations(ctx?.project);
    if (!project && (near(q, ["skills", "tools", "stack", "technologies", "technology", "frameworks"]) || re.skillsAsk.test(q))) return tools();
    if (re.seeSources.test(q) && !/source code/.test(q)) return sourcesList();
    if ((re.contactAsk.test(q) || near(q, ["contact", "linkedin"])) && !/(email|reach).*(traffix|project)/.test(q)) return contact();
    if (!project && re.architecture.test(q)) return architecture();
    if (!project && (re.aboutAsk.test(q) || /\b(who is he|who is aziz)\b/.test(q))) return fromPassage("pr-about", "about");
    const overviewOnly = tokenize(q).filter((t) => !FILLER.has(t) && !GENERIC.has(t) && !["project", "build", "built", "made", "done", "work", "portfolio", "make", "list", "realize", "realise"].includes(t)).length === 0;
    if (!project && (re.builtAsk.test(q) || (/\bprojects?\b/.test(q) && overviewOnly))) return projectsOverview();
    if (!project) { const pf = profile(q); if (pf) return pf; }
    const ent = entityAnswer(q);
    if (ent) return ent;
    if (re.reviewAsk.test(q)) return make({ outcome: "not_verified", intent: "validation", title: "No independent review is recorded", answer: "Nobody else has reviewed these results on record. I ran the evaluations and wrote the test questions myself, and each result links to the file it came from so you can check it.", evidence: [readmeEvidence], limitations: ["The retrieval scores are optimistic for that reason."] });
    if (pk && re.triedAsk.test(q)) { const id = pk === "flyrank" ? "fr-method" : pk === "hr" ? "hr-pipeline" : pk === "alia" ? "al-overview" : "tr-control"; return make({ outcome: "not_verified", intent: "tried", title: "Not verified: only the documented approach", answer: `Other approaches are not documented, so I do not claim them. What the evidence shows is the approach I used: ${P(id).text}`, evidence: P(id).evidence, passageIds: [id], limitations: P(id).limitations }); }
    if (re.offTopic.test(q)) return offTopic("task");
    if (re.softInjection.test(q)) return offTopic("instruction");
    return retrieve(q);
  }

  /* ───────── compound questions: "who is he and what has he built" ───────── */
  function fragments(q: string): string[] {
    const parts = q.split(/\s+(?:and|&|plus|also|then)\s+|[;,]\s+|\?\s+(?=\S)/).map((s) => s.trim()).filter(Boolean);
    const NOUN = /^(skills?|projects?|certifications?|certs?|contact|languages?|internships?|limits?|limitations?|experience|clubs?|volunteering|education)$/;
    const ok = (p: string) => /[a-z0-9]/.test(p) && (p.trim().split(" ").length >= 3 || NOUN.test(p.trim()) || (p.trim().split(" ").length === 2 && /\b(project|thing|one)\b/.test(p)));
    return parts.length >= 2 && parts.length <= 3 && parts.every(ok) ? parts : [];
  }

  function ask(raw: string, ctx?: Context): Answer {
    const input = raw.trim().replace(/\s+/g, " ").replace(/^(ask[\s:,-]+)+/i, "");
    if (!input) return make({ outcome: "error", intent: "invalid", title: "No question", answer: "Type a question first." });
    if (input.length > MAX_QUESTION) return make({ outcome: "error", intent: "invalid", title: "Question too long", answer: `Questions are limited to ${MAX_QUESTION} characters; this one has ${input.length}.` });
    const n = normalise(input);
    const finish = (a: Answer): Answer => {
      const out: Answer = { ...a, lang: n.lang };
      if (n.lang !== "en" && a.outcome !== "info") out.limitations = [...a.limitations, "I understood that as best I could; I answer in English."];
      out.next = ctxOf(out, ctx);
      return out;
    };
    const frags = fragments(stripGreeting(n.text));
    if (frags.length) {
      let c = ctx;
      const parts = frags.map((f) => { const a = route(f, f, c); c = ctxOf(a, c); return a; });
      const refusal = parts.find((p) => ["judgement", "privacy", "injection", "off-topic"].includes(p.intent));
      if (refusal) return finish(refusal);
      const substantive = parts.filter((p) => !(p.intent === "retrieval" && p.outcome !== "supported" && p.outcome !== "contradicted") && p.intent !== "clarify" && p.intent !== "greeting");
      if (substantive.length === parts.length && new Set(parts.map((p) => p.intent + p.title)).size >= 2)
        return finish(make({
          outcome: parts.some((p) => p.outcome === "supported" || p.outcome === "contradicted") ? "supported" : "not_verified", intent: "compound", title: parts.map((p) => p.title).join(" + "),
          answer: parts.map((p, i) => `${i + 1}) ${p.title}: ${p.answer}`).join(" "),
          evidence: uniq(parts.flatMap((p) => p.evidence), (e) => e.url), limitations: uniq(parts.flatMap((p) => p.limitations), (l) => l),
          passageIds: uniq(parts.flatMap((p) => p.passageIds), (x) => x), parts,
        }));
    }
    return finish(route(stripGreeting(n.text), input, ctx));
  }

  return { ask, certs };
}
