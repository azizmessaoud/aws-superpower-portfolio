import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant } from "../../src/assistant/answer";
import { LABELS, PROOF } from "../../src/content/labels";
import type { Corpus, Portfolio } from "../../src/content/schema";

const bot = createAssistant(
  JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus,
  JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio,
);

/* A question that names one project and one aspect of it is answered from that project's own label. The bug this guards: "Where does
 * FlyRank fail?" used to return TraffiX's limits, because free retrieval ranked TraffiX's limitations passage first. */
describe("a project question gets that project's own answer", () => {
  const cases: [string, "traffix" | "flyrank" | "hr", "fails" | "data" | "evaluation" | "review"][] = [
    ["Where does TraffiX fail?", "traffix", "fails"],
    ["Where does FlyRank fail?", "flyrank", "fails"],
    ["Where does the HR prototype fail?", "hr", "fails"],
    ["What data did TraffiX use?", "traffix", "data"],
    ["What data did FlyRank use?", "flyrank", "data"],
    ["How was the FlyRank model judged?", "flyrank", "evaluation"],
    ["How was TraffiX evaluated?", "traffix", "evaluation"],
    ["Who reviews the output of TraffiX?", "traffix", "review"],
    ["Who reviews the HR prototype's flags?", "hr", "review"],
    ["what are the limits of flyrank", "flyrank", "fails"],
  ];
  for (const [q, key, aspect] of cases) {
    it(q, () => {
      const a = bot.ask(q);
      expect(a.outcome).toBe("supported");
      expect(a.intent).toBe(`project-${aspect}`);
      expect(a.answer).toBe(LABELS[key][aspect].join(" "));
      expect(a.evidence).toEqual([PROOF[key]]);
      /* and nothing from another project's label leaks in */
      for (const other of (["traffix", "flyrank", "hr"] as const).filter((k) => k !== key))
        for (const line of LABELS[other][aspect]) if (!LABELS[key][aspect].includes(line)) expect(a.answer).not.toContain(line);
    });
  }
});

describe("what must not be hijacked", () => {
  it("a question naming two projects falls through to retrieval, not to one project's label", () => {
    expect(bot.ask("Where do TraffiX and FlyRank fail?").intent).not.toMatch(/^project-/);
  });
  it("a project question with no aspect keeps its own passage (ambulances)", () => {
    const a = bot.ask("Did TraffiX make ambulances faster?");
    expect(a.outcome).toBe("contradicted");
    expect(a.intent).toBe("retrieval");
  });
  it("data leakage is still its own passage, not the FlyRank data label", () => {
    const a = bot.ask("How did Aziz avoid data leakage?");
    expect(a.intent).toBe("retrieval");
    expect(a.title).toBe("A deliberate leakage test");
  });
  it("a question about no project is unchanged", () => {
    expect(bot.ask("Where did Aziz do internships?").intent).toBe("retrieval");
    expect(bot.ask("What should I ask Aziz in an interview?").intent).toBe("interview");
  });
  it("the proof link of every label is a pinned GitHub blob, so it cannot drift to a moving branch", () => {
    for (const p of Object.values(PROOF)) expect(p.url).toMatch(/github\.com\/azizmessaoud\/[^/]+\/blob\/[0-9a-f]{7,40}\//);
  });
});
