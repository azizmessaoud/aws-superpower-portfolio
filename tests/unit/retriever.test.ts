import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { Corpus, Judged } from "../../src/content/schema";
import { evaluate } from "../../src/retrieval/evaluate";
import { createRetriever } from "../../src/retrieval/retriever";

const corpus = JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus;
const judged = parse(readFileSync("content/judged.yaml", "utf8")) as Judged[];
const retriever = createRetriever(corpus);

describe("ask my brain — keyword baseline", () => {
  it("meets the agreed floor on the judged set", () => {
    const r = evaluate(retriever, judged);
    expect(judged.length).toBeGreaterThanOrEqual(12);
    expect(r.hit3).toBeGreaterThanOrEqual(0.9);
    expect(r.mrr).toBeGreaterThanOrEqual(0.8);
    expect(r.abstainOk).toBe(r.abstainTotal);
  });
  it.each(["What is your IQ?", "How smart is Aziz?", "Do you know Kubernetes?", "Can I hire you?"])(
    "refuses to answer “%s” from evidence it does not have",
    (q) => expect(retriever.search(q)).toEqual([]),
  );
  it("answers trap questions with the limitation, not a flattering passage", () => {
    expect(retriever.search("Are ambulances faster with TraffiX?")[0].passage.id).toBe("tr-ambulance");
    expect(retriever.search("Is TraffiX deployed in Tunis?")[0].passage.id).toBe("tr-simulation");
    expect(retriever.search("What is the OCR accuracy on real documents?")[0].passage.id).toBe("hr-accuracy");
  });
  it("every result carries evidence links and explains why it matched", () => {
    for (const r of retriever.search("How do you process scanned documents?")) {
      expect(r.passage.evidence.length).toBeGreaterThan(0);
      r.passage.evidence.forEach((e) => expect(e.url).toMatch(/^https:\/\/github\.com\/azizmessaoud\//));
      expect(r.why.matchedTerms.length).toBeGreaterThan(0);
    }
  });
  it("finds limitations for a plain-language 'what went wrong'", () => {
    const ids = retriever.search("What went wrong in TraffiX?").map((r) => r.passage.id);
    expect(ids.some((id) => ["tr-limits", "tr-ambulance", "tr-mixed"].includes(id))).toBe(true);
  });
});
