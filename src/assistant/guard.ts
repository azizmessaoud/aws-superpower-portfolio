/* Precision guards for the answer engine. The engine never writes sentences of its own, so it cannot invent a fact; what it can do is
 * show a real passage that does not answer the question. These guards stop that, by abstaining when the question asks about
 * something the evidence never mentions. Pure functions: no model, no network. */
import type { Corpus, CorpusPassage, Portfolio } from "../content/schema";
import { LABELS } from "../content/labels";
import { distance, sameStart } from "../retrieval/fuzzy";
import { stem, tokenize } from "../retrieval/tokenize";

/* the tokenizer stems once; stemming to a fixed point makes "crossings" and "crossing" the same word */
const deep = (w: string) => { for (let i = 0; i < 3; i++) { const n = stem(w); if (n === w) break; w = n; } return w; };
const terms = (text: string) => tokenize(text).map(deep);

/* Everyday words that ask about nothing in particular ("what did he build", "how many"). Everything else in a question is a topic, and a topic the
 * evidence has never seen cannot be answered. Kept short on purpose: a word missing here makes the engine abstain, which is the safe direction. */
const GENERIC = new Set(
  ("aziz azizs he him his she her they people person guy name tell show give list say said ask asked question answer know known " +
    "work worked working build built make made use used using do done get got take took many much long kind type thing things also any some more most " +
    "other same new old first last ever still just only really very around here can could would should may might must mean means like want need try tried " +
    "find found look see seen come go went study studied learn learned learnt tell happen happened happening whether yes no please thanks hello hi " +
    "ever one two three four five six seven eight nine ten few lot lots every each both either whole part parts way ways exactly actually " +
    "personally professionally currently now today recently ago since during before after while about " +
    "avoid prevent handle achieve reach perform create develop design implement apply support provide include involve contain offer ensure improve increase reduce " +
    "decide choose pick run begin end finish join lead manage write wrote read speak spoke live lived keep kept stay turn call called help helped " +
    "programming code coding technical technology set kind sort")
    .split(" ")
    .map((w) => deep(stem(w))),
);

const collect = (v: unknown, out: string[]) => {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collect(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collect(x, out));
};

/** a passage must use at least this share of the question's topic words to answer it (the correct judged answers use 2 of 3 or better) */
export const MIN_COVERAGE = 0.6;

export function createGuard(corpus: Corpus, portfolio: Portfolio) {
  /* every word the site's checked notes use: passages (all fields), the portfolio lists, each project's label lines, and the synonym table */
  const texts: string[] = [];
  collect(corpus.passages.map((p) => [p.title, p.text, p.context, p.tags, p.limitations, p.projectTitle]), texts);
  collect(portfolio, texts);
  collect(LABELS, texts);
  collect(corpus.synonyms, texts);
  const vocab = new Set(terms(texts.join(" ")));
  const vocabList = [...vocab];
  const synKeys = new Set(Object.keys(corpus.synonyms).map((k) => deep(stem(k))));
  /* typo tolerance for the gate is stricter than the retriever's: a 4-letter word may differ only by a swap or a substitution ("star" is not "start"), so a
   * different word one letter away cannot pass as the same one */
  const close = (a: string, b: string) => {
    if (a.length < 4 || !sameStart(a, b)) return false;
    const k = a.length >= 9 ? 2 : 1;
    if (a.length === 4 && b.length !== 4) return false;
    return distance(a, b, k) <= k;
  };

  /* everyday words may be mistyped too ("buld" for "build"), so for them a dropped or added letter is allowed */
  const nearGeneric = (t: string) => GENERIC.has(t) || [...GENERIC].some((g) => g.length >= 4 && t.length >= 4 && sameStart(t, g) && distance(t, g, 1) <= 1);

  /** a word the checked notes never use, even allowing the typos the retriever allows */
  function unseen(term: string): boolean {
    if (vocab.has(term) || synKeys.has(term)) return false;
    return !(vocabList.some((v) => v.length >= 4 && close(term, v)) || nearGeneric(term));
  }

  /** the topic words of a question that the evidence never mentions (empty when every topic is known) */
  function unknownTerms(question: string): string[] {
    const typed = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
    const found = typed.filter((w) => { const t = terms(w)[0]; return t !== undefined && t.length >= 3 && !nearGeneric(t) && unseen(t); });
    return [...new Set(found)];
  }

  /* related words in both directions ("production" and "deployed"), so a synonym in the passage counts as covering the question's word */
  const related = new Map<string, Set<string>>();
  for (const [k, vs] of Object.entries(corpus.synonyms)) for (const a of [k, ...vs]) for (const b of [k, ...vs]) { const x = deep(stem(a)); if (!related.has(x)) related.set(x, new Set()); related.get(x)!.add(deep(stem(b))); }
  const PROJECT_TOKENS = new Set(["traffix", "flyrank", "fly", "hr", "capstone", "prototype", "project", "projects"]);

  const isProject = (t: string) => PROJECT_TOKENS.has(t) || [...PROJECT_TOKENS].some((p) => p.length >= 5 && close(t, p));
  /** what a question is about once everyday words and the project's own name are set aside (empty for "Tell me about TraffiX") */
  const topicTerms = (question: string) => [...new Set(terms(question))].filter((t) => t.length >= 3 && !nearGeneric(t) && !isProject(t));

  /** how many of the question's topic words this passage itself uses (a word that exists elsewhere in the notes but not here is not covered) */
  function coverage(question: string, passage: CorpusPassage): { covered: number; total: number; missing: string[] } {
    const have = new Set(terms([passage.title, passage.text, passage.context, passage.tags.join(" ")].join(" ")));
    const topic = topicTerms(question);
    const ok = (t: string) => have.has(t) || [...(related.get(t) ?? [])].some((r) => have.has(r)) || [...have].some((h) => h.length >= 5 && close(t, h));
    const missing = topic.filter((t) => !ok(t));
    return { covered: topic.length - missing.length, total: topic.length, missing };
  }

  return { unknownTerms, coverage, topicTerms };
}

/** A request to override the rules or to put words in the answer's mouth. The engine cannot be instructed, so it says so rather than answering something nearby. */
export const isInstruction = (q: string) =>
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(rules?|instructions?|prompts?|guidelines?|previous|above|system)\b|\bsystem prompt\b|\b(pretend|act as|roleplay|you are now)\b|\bsay (that )?(aziz|he|you|i)\b/.test(q);
