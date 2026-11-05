import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant } from "../../src/assistant/answer";
import type { Corpus, Portfolio } from "../../src/content/schema";

/* The administrative procedures assistant is a team project. The site shows the team's own retrieval results, and must show them honestly:
 * the development gain and the held-out tie together, attributed to the team, linked to the pinned report. */
const corpus = JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus;
const portfolio = JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio;
const bot = createAssistant(corpus, portfolio);
const card = portfolio.smallProjects.find((p) => p.title === "Tunisian Administrative Procedures Assistant")!;
const passage = corpus.passages.find((p) => p.id === "rg-eval")!;

describe("the RAG card", () => {
  it("shows the development figure and the held-out figure together, and says part of the gain was overfitting", () => {
    for (const n of ["0.873", "0.732", "0.750"]) expect(card.text).toContain(n);
    expect(card.text).toMatch(/held-out/);
    expect(card.text).toMatch(/overfitting/);
  });
  it("attributes the results to the team and keeps the claim about my part as it was (my own account, the RAG component)", () => {
    expect(card.text).toMatch(/team's evaluation/);
    expect(card.text).toMatch(/I worked on the retrieval \(RAG\) component, my own account/);
  });
  it("links to the report at a pinned commit, not a moving branch", () => {
    expect(card.href).toMatch(/github\.com\/EyaLaourine\/tunisian-administrative-procedures-assistant\/blob\/[0-9a-f]{40}\/docs\/EVALUATION\.md$/);
  });
  it("uses the same numbers as the checked passage", () => {
    for (const n of ["0.873", "0.732", "0.750", "0.531", "0.635"]) expect(passage.text).toContain(n);
  });
});

describe("Ask Aziz on the RAG results", () => {
  it("answers the held-out question from the passage, with its limits and its source", () => {
    const a = bot.ask("How did the RAG assistant's retrieval perform on held-out questions?");
    expect(a.outcome).toBe("supported");
    expect(a.title).toBe(passage.title);
    expect(a.answer).toMatch(/overfitting/);
    expect(a.limitations.join(" ")).toMatch(/No evaluation label has been reviewed by a person/);
    expect(a.evidence.some((e) => e.url.includes("/docs/EVALUATION.md"))).toBe(true);
  });
  it("does not claim the system is in production", () => {
    expect(passage.limitations.join(" ")).toMatch(/not a claim about a deployed system/);
    expect(passage.text).not.toMatch(/production/i);
  });
  it("is not offered as an answer about the HR prototype", () => {
    expect(bot.ask("Did Aziz build the HR prototype alone?").title).not.toBe(passage.title);
  });
});
