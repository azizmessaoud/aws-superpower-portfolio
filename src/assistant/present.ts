/* How an answer is shown, kept apart from how it is found. Pure: no engine changes, no new facts. The engine returns the passage text;
 * this picks the sentence a visitor reads first, counts what backs it, and offers the questions that naturally come next. */
import type { Answer } from "./answer";
import { LABELS } from "../content/labels";

/** the engine's own sentence for a question whose premise the evidence contradicts; the card shows it as a callout, so the headline drops it */
export const CONTRADICTION = "The evidence disagrees with that premise.";
export type ProjectId = "traffix" | "flyrank" | "hr";
export interface Presented {
  /** the one sentence to read first (the verdict is shown separately, so "Not verified." and the contradiction preamble are not repeated) */
  headline: string;
  /** the rest of the text, or null when the headline is the whole answer */
  detail: string | null;
  /** a project's own label lines (where it fails, its data, how it was judged, who reviews it): shown as a short list instead of a paragraph */
  points: string[] | null;
  sources: number;
  limits: number;
  followUps: string[];
}

/* Lines for answers whose first sentence is a list or an enumeration: say what the list is, and keep the list as the detail. */
const SUMMARY: Record<string, (a: Answer) => string> = {
  certifications: (a) => `${a.evidence.length} credential${a.evidence.length === 1 ? "" : "s"}, each linking to its issuer's own page.`,
  tools: () => "The tools I use, grouped by the project where I used them.",
  interview: () => "Questions worth asking me, each linked to the evidence behind it.",
  projects: () => "Three case studies, each ending with where it fails.",
};
const LIMIT = 190;
const REPO: Record<ProjectId, string> = { traffix: "/azizmessaoud/traffix/", flyrank: "/azizmessaoud/flyrank/", hr: "/azizmessaoud/hr-anomaly-detection/" };
/** The project an answer is wholly about: every GitHub source it cites belongs to that one project's repository. An answer that cites
 *  several projects (the interview questions, the tools) is about none of them. */
export function projectIdOf(a: Answer): ProjectId | undefined {
  const gh = a.evidence.filter((e) => e.url.includes("github.com/azizmessaoud/"));
  if (!gh.length) return undefined;
  return (Object.keys(REPO) as ProjectId[]).find((k) => gh.every((e) => e.url.includes(REPO[k])));
}
const NAME: Record<ProjectId, string> = { traffix: "TraffiX", flyrank: "FlyRank", hr: "the HR prototype" };

/** the first sentence of `text` (a full stop followed by a space; "116.3 s" does not split) */
function firstSentence(text: string): [string, string] {
  const m = /^(.+?[.!?])(?:\s+|$)/.exec(text);
  return m ? [m[1], text.slice(m[0].length).trim()] : [text, ""];
}

export function presentAnswer(a: Answer, project?: ProjectId): Presented {
  let text = a.answer.trim();
  if (a.outcome === "contradicted") text = text.startsWith(CONTRADICTION) ? text.slice(CONTRADICTION.length).trim() : text;
  if (a.outcome === "not_verified") text = text.replace(/^Not verified\.\s*/, "");
  let headline: string, detail: string;
  const aspect = /^project-(fails|data|evaluation|review)$/.exec(a.intent)?.[1] as "fails" | "data" | "evaluation" | "review" | undefined;
  const points = aspect && project ? LABELS[project][aspect] : null;
  if (points) { headline = points[0]; detail = ""; }
  else if (SUMMARY[a.intent]) { headline = SUMMARY[a.intent](a); detail = text; }
  else {
    [headline, detail] = firstSentence(text);
    if (headline.length > LIMIT) {
      const cut = Math.max(headline.lastIndexOf("; ", LIMIT), headline.lastIndexOf(", ", LIMIT), headline.lastIndexOf(" · ", LIMIT));
      headline = (cut > 60 ? headline.slice(0, cut) : headline.slice(0, LIMIT).replace(/\s+\S*$/, "")) + "…";
      detail = text; /* the headline was cut, so the detail is the whole text */
    }
  }
  return { headline, detail: detail || null, points, sources: a.evidence.length, limits: a.limitations.length, followUps: followUps(a, project) };
}

/* The next questions. Every one is checked against the engine in tests/unit/present.test.ts: none may error, and a project question
 * must come back as that project's own answer. */
export function followUps(a: Answer, project?: ProjectId): string[] {
  if (a.outcome === "error") return [];
  const aspect = /^project-(\w+)$/.exec(a.intent)?.[1];
  if (project) {
    const n = NAME[project];
    const all: [string, string][] = [["fails", `Where does ${n} fail?`], ["data", `What data did ${n} use?`], ["evaluation", `How was ${n} judged?`], ["review", `Who reviews the output of ${n}?`]];
    const next = all.filter(([k]) => k !== aspect).map(([, q]) => q);
    const lead = project === "traffix" && a.title !== "My part of the team" ? ["What did Aziz personally build in TraffiX?"] : [];
    return [...lead, ...next].slice(0, 3);
  }
  switch (a.intent) {
    case "tools": return ["What are the limits of Aziz's results?", "What should I ask Aziz in an interview?", "How can I contact Aziz?"];
    case "certifications": return ["What tools does Aziz use, and where?", "What should I ask Aziz in an interview?", "How can I contact Aziz?"];
    case "contact": return ["What are Aziz's certifications?", "What did Aziz personally build in TraffiX?", "What should I ask Aziz in an interview?"];
    case "interview": return ["Where does FlyRank fail?", "Did TraffiX make ambulances faster?", "How can I contact Aziz?"];
    case "aws-status": return ["Does Aziz use Bedrock?", "What tools does Aziz use, and where?", "What should I ask Aziz in an interview?"];
    case "aws-service": return ["What is the AWS hosting status?", "What tools does Aziz use, and where?", "What should I ask Aziz in an interview?"];
    default: return ["What did Aziz personally build in TraffiX?", "What tools does Aziz use, and where?", "What should I ask Aziz in an interview?"];
  }
}
