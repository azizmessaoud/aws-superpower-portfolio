import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant } from "../../src/assistant/answer";
import { presentAnswer, projectIdOf } from "../../src/assistant/present";
import { SAMPLES, SAMPLE_ABSTAINS } from "../../src/assistant/samples";
import type { Corpus, Portfolio } from "../../src/content/schema";

/* What a visitor tries first must work: the sample questions under the Ask bar, and every follow-up the site itself suggests. */
const bot = createAssistant(JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus, JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio);
const view = (q: string) => { const a = bot.ask(q); return { a, v: presentAnswer(a, projectIdOf(a)) }; };

describe("the sample questions under the Ask bar", () => {
  it("are six, and none is a duplicate", () => { expect(SAMPLES.length).toBe(6); expect(new Set(SAMPLES).size).toBe(6); });
  for (const q of SAMPLES) {
    it(q, () => {
      const { a } = view(q);
      if (q === SAMPLE_ABSTAINS) { expect(a.outcome).toBe("not_verified"); expect(a.evidence).toEqual([]); expect(a.title).toMatch(/kubernetes/i); }
      else { expect(a.outcome).toBe("supported"); expect(a.evidence.length).toBeGreaterThan(0); }
    });
  }
  it("do not depend on a TraffiX result, which is being re-sourced", () => {
    for (const q of SAMPLES) expect(q).not.toMatch(/ambulance|faster|pedestrian|wait/i);
  });
  it("show the held-out result with its caveat", () => {
    const { a } = view("Did the RAG gain hold up on held-out questions?");
    expect(a.answer).toMatch(/overfitting/);
    expect(a.limitations.length).toBeGreaterThan(0);
  });
});

describe("every follow-up question the site suggests gets an answer", () => {
  /* collect the follow-ups of a spread of answers, then ask each of them */
  const seeds = [...SAMPLES, "Where does TraffiX fail?", "Where does FlyRank fail?", "Where does the HR prototype fail?", "What tools does Aziz use?", "What are Aziz's certifications?", "How can I contact Aziz?", "Who is Aziz?", "Does Aziz use Bedrock?"];
  const followUps = [...new Set(seeds.flatMap((q) => view(q).v.followUps))];
  it("there are some to test", () => expect(followUps.length).toBeGreaterThan(8));
  for (const q of followUps) {
    it(q, () => {
      const { a } = view(q);
      expect(a.outcome).not.toBe("error");
      /* "Does Aziz use Bedrock?" is offered on purpose: the honest answer is "not verified" */
      if (q !== "Does Aziz use Bedrock?") expect(a.outcome, `${q} -> ${a.title}`).not.toBe("not_verified");
    });
  }
  it('"limits" and "limitations" are the same question', () => {
    expect(bot.ask("What are the limits of Aziz's results?").intent).toBe("limitations");
    expect(bot.ask("What are the limitations of Aziz's results?").intent).toBe("limitations");
  });
});
