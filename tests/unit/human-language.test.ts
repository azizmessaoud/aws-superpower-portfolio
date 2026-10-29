import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant, type Answer } from "../../src/assistant/answer";
import type { Corpus, Portfolio } from "../../src/content/schema";
import { distance, isNear } from "../../src/retrieval/fuzzy";

const bot = createAssistant(JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus, JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio);
const body = (a: Answer) => [a.title, a.answer, ...a.limitations].join(" ");

describe("typos and shorthand", () => {
  it("edit distance counts a swap as one typo, and short words get no tolerance", () => {
    expect(distance("traffix", "trafifx")).toBe(1);
    expect(isNear("certifcation", "certification")).toBe(true);
    expect(isNear("cat", "car")).toBe(false);
  });
  it.each([
    ["whois aziz", "pr-about", /ESPRIT/],
    ["who is aziz", "pr-about", /ESPRIT/],
    ["whats aziz certifs", "certifications", /OCI Data Science/],
    ["wat did aziz build in trafix", "role", /Control pair/],
    ["wat did aziz buld in trafix", "retrieval", /Control pair/],
    ["do you speek french", "profile", /Arabic, French and English/],
    ["whats his skils", "tools", /scikit-learn/],
    ["how can i contcat him", "contact", /aziz\.messaoud@esprit\.tn/],
    ["did trafifx make ambulences faster", "retrieval", /240\.0 s/],
    ["certifcations of aziz", "certifications", /OCI/],
    ["does he use bedrok", "aws-service", /Not verified/],
    ["what sould i ask aziz in an intervew", "interview", /ambulance/],
  ])("%j is understood", (q, intent, text) => {
    const a = bot.ask(q);
    expect(a.intent, q).toBe(intent === "pr-about" ? "about" : intent);
    expect(body(a), q).toMatch(text);
    expect(a.evidence.length, q).toBeGreaterThan(0);
  });
});

describe("questions a recruiter or HR person asks", () => {
  it("tell me about yourself / who is he: the profile, with the missing dates named", () => {
    for (const q of ["Tell me about yourself", "who is he", "Can you introduce Aziz?"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).toBe("supported");
      expect(body(a), q).toContain("2027");
      expect(a.limitations.join(" "), q).toContain("No start or end dates");
    }
  });
  it("availability and what he is looking for", () => {
    const a = bot.ask("Is Aziz available for an internship?");
    expect(a.outcome).toBe("supported");
    expect(a.answer).toContain("seeking a");
    expect(a.limitations.join(" ")).toContain("No start or end dates");
    expect(a.answer).not.toMatch(/immediately|available from|start date is/i);
  });
  it("internships: companies and roles, but FlyRank dates stay out", () => {
    const a = bot.ask("Where did he do internships?");
    expect(a.answer).toMatch(/Sopra HR Software/);
    expect(a.answer).toMatch(/FlyRank AI/);
    const flyrank = a.answer.split(";").find((c) => c.includes("FlyRank"))!;
    expect(flyrank).not.toMatch(/20\d\d|July|August|September/);
    expect(a.limitations.join(" ")).toContain("FlyRank dates are not shown");
  });
  it("languages, location and volunteering come from evidence", () => {
    expect(bot.ask("Which languages does he speak?").answer).toContain("Arabic, French and English");
    const where = bot.ask("Where is he based?");
    expect(where.answer).toContain("Tunisia");
    expect(where.answer).not.toMatch(/Ariana|Nabeul/);
    expect(bot.ask("Any volunteering or clubs?").answer).toContain("DeepFlow");
  });
  it("a project overview lists the three case studies and the smaller ones", () => {
    const a = bot.ask("What projects has he done?");
    expect(a.intent).toBe("projects");
    for (const t of ["TraffiX", "FlyRank", "HR document checks", "InnoTravel"]) expect(a.answer).toContain(t);
  });
  it("judgements and money are not facts: no claim, but the evidence is offered", () => {
    for (const q of ["Why should we hire you?", "What are his strengths?", "What is your salary expectation?", "How much do you want to be paid?"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).toBe("not_verified");
      expect(a.intent, q).toBe("judgement");
      expect(a.evidence.length, q).toBeGreaterThan(0);
      expect(body(a), q).not.toMatch(/best|excellent|expert|top|\$|€|TND/i);
    }
  });
  it("still refuses what nothing supports, even when it sounds friendly", () => {
    for (const q of ["Is he married?", "What is his IQ?", "Does he know Kubernetes?", "What is his favourite food?"]) expect(bot.ask(q).outcome, q).toBe("not_verified");
  });
  it("a typo does not turn a no-evidence question into an answer", () => {
    expect(bot.ask("does he hav a phd").outcome).toBe("not_verified");
  });
});
