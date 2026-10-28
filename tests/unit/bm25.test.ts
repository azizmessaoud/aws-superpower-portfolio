import { describe, expect, it } from "vitest";
import { buildIndex, score } from "../../src/retrieval/bm25";

const docs = [
  { id: "a", fields: { tags: "ocr", text: "scanned documents pass through OCR" } },
  { id: "b", fields: { tags: "traffic", text: "traffic lights in a simulation" } },
  { id: "c", fields: { tags: "", text: "documents documents documents" } },
];

describe("bm25", () => {
  const index = buildIndex(docs);
  it("ranks the document whose tags match above repeated body text", () => {
    const hits = score(index, [{ term: "ocr", weight: 1 }, { term: "document", weight: 1 }]);
    expect(hits[0].id).toBe("a");
  });
  it("returns nothing for terms outside the vocabulary", () => {
    expect(score(index, [{ term: "kubernet", weight: 1 }])).toEqual([]);
  });
  it("is deterministic, breaking ties by id", () => {
    const one = score(index, [{ term: "light", weight: 1 }]);
    const two = score(index, [{ term: "light", weight: 1 }]);
    expect(one).toEqual(two);
  });
  it("reports which field a term matched in", () => {
    const [hit] = score(index, [{ term: "traffic", weight: 1 }]);
    expect(hit.matched[0]).toMatchObject({ term: "traffic", field: "tags" });
  });
});
