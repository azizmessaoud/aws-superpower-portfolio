import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant } from "../../src/assistant/answer";
import type { Corpus, Portfolio } from "../../src/content/schema";

/* My part in TraffiX is stated in my own words (the architecture that stops the system from hallucinating). That is my own account, so it must never
 * read as if the README said it: the README's pair assignment stays beside it, and the difference is stated. */
const corpus = JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus;
const portfolio = JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio;
const bot = createAssistant(corpus, portfolio);
const role = corpus.passages.find((p) => p.id === "tr-role")!;

describe("my part in TraffiX", () => {
  it("is said in my words, as my description", () => {
    expect(role.text).toMatch(/My part, as I describe it, was the architecture that stops the system from hallucinating/);
  });
  it("keeps the README's pair assignment beside it", () => {
    expect(role.text).toMatch(/The README lists me in the Control pair with Fares Ben Kacem/);
    expect(role.text).toMatch(/roles rotate/);
  });
  it("says that it is my own account and that the README gives Synapse to another pair", () => {
    const lim = role.limitations.join(" ");
    expect(lim).toMatch(/my own account/);
    expect(lim).toMatch(/Synapse/);
    expect(lim).toMatch(/did not build it alone/);
  });
  it("is found by the questions a visitor asks", () => {
    for (const q of ["What did Aziz personally build in TraffiX?", "Did Aziz work on preventing hallucination?", "What was Aziz's part in TraffiX?"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).toBe("supported");
      expect(a.title, q).toBe("My part of the team");
    }
  });
  it("is the same on the project card, the terminal and the skills list", () => {
    const skill = portfolio.skills.find((s) => s.title === "Multi-agent systems")!;
    expect(skill.where).toBe("TraffiX (Control pair, per the README)");   /* the skills list is sourced to the README table, so it says what the table says */
    expect(readFileSync("src/sections/projects/summary.ts", "utf8")).toMatch(/The architecture that stops the system from hallucinating \(my own account\)/);
    expect(readFileSync("src/terminal/commands.ts", "utf8")).toMatch(/the architecture that stops the system from hallucinating/);
  });
});
