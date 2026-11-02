import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant, type Answer } from "../../src/assistant/answer";
import { projectIdOf, presentAnswer } from "../../src/assistant/present";
import { LABELS, PROJECT_NAME } from "../../src/content/labels";
import type { Corpus, Portfolio } from "../../src/content/schema";

const bot = createAssistant(
  JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus,
  JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio,
);
const QUESTIONS = [
  "What did Aziz personally build in TraffiX?", "Did TraffiX make ambulances faster?", "What is the AWS hosting status?", "Does Aziz use Bedrock?",
  "What should I ask Aziz in an interview?", "Where did Aziz do internships?", "What are Aziz's certifications?", "What tools does Aziz use, and where?",
  "Who is Aziz?", "How can I contact Aziz?", "Where does FlyRank fail?", "How did Aziz avoid data leakage?", "What is the OCR accuracy on real documents?",
  "Which project is the strongest?", "What is your favourite colour?",
];
const present = (q: string) => { const a = bot.ask(q); return { a, p: presentAnswer(a, projectIdOf(a)) }; };

describe("the headline is one readable sentence", () => {
  for (const q of QUESTIONS) {
    it(q, () => {
      const { p } = present(q);
      expect(p.headline.length).toBeGreaterThan(15);
      expect(p.headline.length).toBeLessThanOrEqual(200);
      expect(p.detail === null || /[.!?…]$/.test(p.headline), "a headline ends like a sentence unless it is the whole one-line answer").toBe(true);
      expect(p.headline).not.toMatch(/^(The evidence disagrees with that premise|Not verified)\./); /* the verdict chip says that, once */
    });
  }
  it("a contradicted answer leads with the fact, not with the contradiction notice", () => {
    const { a, p } = present("Did TraffiX make ambulances faster?");
    expect(a.outcome).toBe("contradicted");
    expect(p.headline).toMatch(/slower/i);
    expect(p.headline).not.toMatch(/disagrees/i);
  });
  it("a list answer says what the list is, and keeps the list as the detail", () => {
    const { a, p } = present("What are Aziz's certifications?");
    expect(p.headline).toMatch(/^\d+ credentials, each linking to its issuer/);
    expect(p.detail).toBe(a.answer);
  });
  it("nothing is lost: headline plus detail is the whole answer (after the verdict notice), except where the headline is a summary or was cut", () => {
    for (const q of QUESTIONS) {
      const { a, p } = present(q);
      const body = a.answer.replace(/^(The evidence disagrees with that premise\.|Not verified\.)\s*/, "");
      const whole = `${p.headline}${p.detail ? " " + p.detail : ""}`;
      const summarised = p.headline.endsWith("…") || /^\d+ credential|^The tools I use|^Questions worth|^Three case studies, each/.test(p.headline);
      if (p.points) { expect(p.points.join(" ")).toBe(body); continue; } /* a list answer carries its whole text in the points */
      if (!summarised) expect(whole.replace(/\s+/g, " ")).toBe(body.replace(/\s+/g, " "));
      else expect(p.detail).toBe(body);
    }
  });
  it("a project's own label is shown as its lines, in order", () => {
    const { p } = present("Where does FlyRank fail?");
    expect(p.points).toEqual(LABELS.flyrank.fails);
    expect(p.headline).toBe(LABELS.flyrank.fails[0]);
    expect(present("Did TraffiX make ambulances faster?").p.points).toBeNull();
  });
  it("the counts are the real counts", () => {
    const { a, p } = present("Where does FlyRank fail?");
    expect(p.sources).toBe(a.evidence.length);
    expect(p.limits).toBe(a.limitations.length);
  });
});

describe("every follow-up question is answerable, and a project follow-up gets that project's own answer", () => {
  it("never errors, never repeats, and a chain two steps deep stays honest", () => {
    const seen = new Set<string>();
    const walk = (q: string, depth: number) => {
      const { a, p } = present(q);
      expect(new Set(p.followUps).size, `duplicates after "${q}"`).toBe(p.followUps.length);
      for (const f of p.followUps) {
        const r = bot.ask(f);
        expect(r.outcome, `"${f}" (offered after "${q}")`).not.toBe("error");
        seen.add(f);
        const named = (["traffix", "flyrank", "hr"] as const).find((k) => new RegExp(PROJECT_NAME[k] === "HR prototype" ? "HR prototype" : PROJECT_NAME[k], "i").test(f));
        if (named && /Where does|What data did|How was|Who reviews/.test(f)) {
          expect(r.intent, `"${f}" must come from the project's own label`).toMatch(/^project-/);
          expect(r.title).toContain(PROJECT_NAME[named]);
        }
        if (depth < 2) walk(f, depth + 1);
      }
      return a;
    };
    for (const q of QUESTIONS) walk(q, 0);
    expect(seen.size).toBeGreaterThan(8);
  });
  it("an error answer offers nothing; a project answer never offers its own aspect again", () => {
    const err: Answer = { outcome: "error", intent: "invalid", title: "x", answer: "x", evidence: [], limitations: [] };
    expect(presentAnswer(err).followUps).toEqual([]);
    const { p } = present("Where does FlyRank fail?");
    expect(p.followUps.some((f) => /fail/.test(f))).toBe(false);
    expect(p.followUps.every((f) => /FlyRank/.test(f))).toBe(true);
  });
  it("only an answer wholly about one project counts as that project's", () => {
    expect(projectIdOf(bot.ask("What should I ask Aziz in an interview?"))).toBeUndefined();
    expect(projectIdOf(bot.ask("What tools does Aziz use, and where?"))).toBeUndefined();
    expect(projectIdOf(bot.ask("Where does FlyRank fail?"))).toBe("flyrank");
    expect(projectIdOf(bot.ask("Did TraffiX make ambulances faster?"))).toBe("traffix");
  });
});
