/* Scores the retriever on content/judged.yaml: hit@1, hit@3, MRR and correct abstentions. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Corpus } from "../src/content/schema";
import { evaluate } from "../src/retrieval/evaluate";
import { createRetriever } from "../src/retrieval/retriever";
import { loadContent } from "./content";

const corpus = JSON.parse(readFileSync(new URL("../src/generated/corpus.json", import.meta.url), "utf8")) as Corpus;
const report = evaluate(createRetriever(corpus), loadContent().judged);
console.table(report.rows.map((r) => ({ id: r.id, rank: r.rank ?? "-", ok: r.ok ? "yes" : "NO", top: r.top.join(", "), question: r.question.slice(0, 48) })));
console.log(`hit@1 ${report.hit1.toFixed(2)} · hit@3 ${report.hit3.toFixed(2)} · MRR ${report.mrr.toFixed(3)} · answerable ${report.answerable} · abstentions correct ${report.abstainOk}/${report.abstainTotal}`);
mkdirSync(new URL("../reports/", import.meta.url), { recursive: true });
writeFileSync(new URL("../reports/retrieval-keyword.json", import.meta.url), JSON.stringify(report, null, 2));
