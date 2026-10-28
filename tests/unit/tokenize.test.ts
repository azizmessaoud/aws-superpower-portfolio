import { describe, expect, it } from "vitest";
import { stem, tokenize } from "../../src/retrieval/tokenize";

describe("tokenize", () => {
  it("lowercases, folds accents and drops stopwords", () => {
    expect(tokenize("Comment détectez-vous les anomalies ?")).toEqual(["detect", "anomaly"]);
  });
  it("splits on punctuation and keeps numbers", () => {
    expect(tokenize("Precision@50 = 0.94")).toEqual(["precision", "50", "0", "94"]);
  });
  it("stems common suffixes without mangling short words", () => {
    expect(stem("pedestrians")).toBe("pedestrian");
    expect(stem("crossing")).toBe("cross");
    expect(stem("processes")).toBe("process");
    expect(stem("bus")).toBe("bus");
    expect(stem("analysis")).toBe("analysis");
  });
});
