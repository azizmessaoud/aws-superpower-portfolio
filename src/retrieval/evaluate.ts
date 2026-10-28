import type { Judged } from "../content/schema";
import type { createRetriever } from "./retriever";

export function evaluate(retriever: ReturnType<typeof createRetriever>, judged: Judged[]) {
  const rows = judged.map((q) => {
    const top = retriever.search(q.question, 3).map((r) => r.passage.id);
    if (!q.relevant.length) return { id: q.id, question: q.question, top, rank: null as number | null, ok: top.length === 0, abstain: true };
    const idx = top.findIndex((id) => q.relevant.includes(id));
    return { id: q.id, question: q.question, top, rank: idx < 0 ? null : idx + 1, ok: idx >= 0, abstain: false };
  });
  const answerable = rows.filter((r) => !r.abstain);
  const hit = (k: number) => answerable.filter((r) => r.rank !== null && r.rank <= k).length / answerable.length;
  return {
    rows,
    answerable: answerable.length,
    hit1: hit(1),
    hit3: hit(3),
    mrr: answerable.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / answerable.length,
    abstainOk: rows.filter((r) => r.abstain && r.ok).length,
    abstainTotal: rows.filter((r) => r.abstain).length,
  };
}
