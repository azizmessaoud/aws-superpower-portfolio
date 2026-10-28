/* BM25 over weighted fields (tags ×2, title ×1.5, text ×1, context ×0.5), k1 = 1.2, b = 0.75. */
import { tokenize } from "./tokenize";

export interface Doc { id: string; fields: Record<string, string> }
export const FIELD_WEIGHTS: Record<string, number> = { tags: 2, title: 1.5, text: 1, context: 0.5 };
const K1 = 1.2;
const B = 0.75;

export interface Index {
  ids: string[];
  tf: Map<string, number>[];                 /* weighted term frequency per doc */
  fieldOf: Map<string, string>[];            /* the heaviest field each term came from, for "why" */
  len: number[];
  avgLen: number;
  df: Map<string, number>;
}

export function buildIndex(docs: Doc[]): Index {
  const tf: Map<string, number>[] = [];
  const fieldOf: Map<string, string>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const doc of docs) {
    const counts = new Map<string, number>();
    const from = new Map<string, string>();
    let total = 0;
    for (const [field, value] of Object.entries(doc.fields)) {
      const w = FIELD_WEIGHTS[field] ?? 1;
      for (const term of tokenize(value)) {
        counts.set(term, (counts.get(term) ?? 0) + w);
        if (!from.has(term) || (FIELD_WEIGHTS[from.get(term)!] ?? 1) < w) from.set(term, field);
        total += w;
      }
    }
    counts.forEach((_, term) => df.set(term, (df.get(term) ?? 0) + 1));
    tf.push(counts);
    fieldOf.push(from);
    len.push(total);
  }
  return { ids: docs.map((d) => d.id), tf, fieldOf, len, avgLen: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length), df };
}

export interface Hit { id: string; score: number; matched: { term: string; field: string; via?: string }[] }

/** terms: query terms with a weight (1 for typed words, lower for synonym expansions). */
export function score(index: Index, terms: { term: string; weight: number; via?: string }[]): Hit[] {
  const N = index.ids.length;
  const hits: Hit[] = [];
  index.ids.forEach((id, d) => {
    let s = 0;
    const matched: Hit["matched"] = [];
    for (const { term, weight, via } of terms) {
      const f = index.tf[d].get(term);
      if (!f) continue;
      const n = index.df.get(term) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += weight * idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * index.len[d]) / index.avgLen)));
      if (!matched.some((m) => m.term === term)) matched.push({ term, field: index.fieldOf[d].get(term)!, via });
    }
    if (s > 0) hits.push({ id, score: s, matched });
  });
  return hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
