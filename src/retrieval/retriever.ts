/* Terminal Explorer retrieval: finds verified portfolio passages for a question. It retrieves evidence;
 * it never generates answers and never scores the person. */
import type { Corpus, CorpusPassage } from "../content/schema";
import { buildIndex, score } from "./bm25";
import { allowedTypos, distance, sameStart } from "./fuzzy";
import { stem, tokenize } from "./tokenize";

export interface Result {
  passage: CorpusPassage;
  score: number;
  why: { matchedTerms: string[]; fields: string[]; mode: "keyword" };
}

/* Below this a match is too weak to show as evidence: the honest answer is "no verified passage". */
export const MIN_SCORE = 2.2;
/* Results scoring under this share of the best one are dropped as noise. */
export const RELATIVE_CUTOFF = 0.4;

export function createRetriever(corpus: Corpus) {
  const index = buildIndex(
    corpus.passages.map((p) => ({ id: p.id, fields: { tags: p.tags.join(" "), title: p.title, text: p.text, context: p.context } })),
  );
  const byId = new Map(corpus.passages.map((p) => [p.id, p]));
  const synonyms = new Map(Object.entries(corpus.synonyms).map(([k, v]) => [stem(k), v.map(stem)]));

  const vocab = [...index.df.keys()];

  /* A typed word the corpus has never seen may be a typo: borrow the closest corpus words (at most the allowed typos away). */
  function fuzzy(term: string): string[] {
    if (index.df.has(term)) return [];
    const k = allowedTypos(term);
    if (!k) return [];
    const near = vocab.filter((v) => v.length >= 4 && sameStart(term, v) && distance(term, v, k) <= k);
    return near.sort((a, b) => distance(term, a, k) - distance(term, b, k)).slice(0, 2);
  }

  function expand(query: string) {
    const typed = tokenize(query).filter((t) => !/^\d$/.test(t));
    const terms = typed.map((term) => ({ term, weight: 1, via: undefined as string | undefined }));
    for (const t of typed)
      for (const f of fuzzy(t))
        if (!terms.some((x) => x.term === f)) terms.push({ term: f, weight: 0.7, via: `${t}, a likely typo` });
    for (const t of typed)
      for (const s of synonyms.get(t) ?? [])
        if (!terms.some((x) => x.term === s)) terms.push({ term: s, weight: 0.6, via: t });
    return terms;
  }

  function search(query: string, k = 3): Result[] {
    const hits = score(index, expand(query));
    if (!hits.length || hits[0].score < MIN_SCORE) return [];
    return hits
      .filter((h) => h.score >= hits[0].score * RELATIVE_CUTOFF)
      .slice(0, k)
      .map((h) => ({
        passage: byId.get(h.id)!,
        score: Math.round(h.score * 100) / 100,
        why: {
          matchedTerms: h.matched.map((m) => (m.via ? `${m.term} (from “${m.via}”)` : m.term)),
          fields: [...new Set(h.matched.map((m) => m.field))],
          mode: "keyword" as const,
        },
      }));
  }

  /** The same search, plus what the question contained: its content terms and which of them the top result matched.
   * The answer engine uses this to decide whether a match is an answer, only related, or nothing. */
  function inspect(query: string, k = 3) {
    const typed = [...new Set(tokenize(query).filter((t) => !/^\d$/.test(t)))];
    const results = search(query, k);
    const top = results[0];
    /* a typed word counts as matched when the result matched it directly, via a synonym of it, or via a typo fix of it */
    const hit = (t: string) => top!.why.matchedTerms.some((m) => m === t || m.includes(`from “${t}”`) || m.includes(`from “${t}, a likely typo”`));
    const matched = top ? typed.filter(hit) : [];
    /* a short word matched only through a typo fix ("life" for "live") is too easy a coincidence to count as a rare anchor */
    const direct = (t: string) => top!.why.matchedTerms.some((m) => m === t || (m.includes(`from “${t}”`)));
    const rare = matched.filter((t) => (index.df.get(t) ?? 0) <= 4 && (direct(t) || t.length >= 6));
    return { typed, results, matched, rare, df: (t: string) => index.df.get(t) ?? 0 };
  }

  return { search, inspect, mode: "keyword" as const, status: "ready" as const };
}
