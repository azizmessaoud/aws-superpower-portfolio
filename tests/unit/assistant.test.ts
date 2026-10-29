import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant, MAX_QUESTION, type Answer } from "../../src/assistant/answer";
import type { Corpus, Portfolio } from "../../src/content/schema";

const corpus = JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus;
const portfolio = JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio;
const bot = createAssistant(corpus, portfolio);
const urls = (a: Answer) => a.evidence.map((e) => e.url);
const all = (a: Answer) => [a.title, a.answer, ...a.limitations].join("\n");

describe("the required demo questions", () => {
  it("TraffiX role: my part only, team-project limit, cites the README section", () => {
    const a = bot.ask("What did Aziz personally build in TraffiX?");
    expect(a.outcome).toBe("supported");
    expect(a.answer).toContain("Control pair");
    expect(all(a)).toContain("did not build it alone");
    expect(urls(a).some((u) => /traffix\/blob\/d54b071[0-9a-f]*\/README\.md#L635-L648/.test(u))).toBe(true);
  });
  it("ambulances: the evidence contradicts the premise and shows the slower numbers", () => {
    const a = bot.ask("Did TraffiX make ambulances faster?");
    expect(a.outcome).toBe("contradicted");
    expect(a.answer).toContain("240.0 s against 213.2 s");
    expect(urls(a).some((u) => u.includes("prototype-validation.md"))).toBe(true);
    expect(a.limitations.join(" ")).toMatch(/untested/);
  });
  it("worst result: names the weakest measured result without ranking unlike metrics", () => {
    const a = bot.ask("Which project performed worst?");
    expect(a.answer).toContain("No project is ranked worst");
    expect(a.answer).toContain("240.0 s");
    expect(a.limitations.join(" ")).toContain("not comparable");
    expect(urls(a).length).toBeGreaterThanOrEqual(3);
  });
  it("AWS hosting: a build config is not a deployment", () => {
    const a = bot.ask("What is the AWS hosting status?");
    expect(portfolio.aws.deployed).toBe(false);
    expect(a.outcome).toBe("not_verified");
    expect(a.answer).toContain("does not prove a deployment");
    expect(a.answer).not.toMatch(/https:\/\/\S*amplifyapp/);
    expect(urls(a).some((u) => u.endsWith("/amplify.yml"))).toBe(true);
    expect(urls(a).some((u) => u.endsWith("/content/aws-status.yaml"))).toBe(true);
  });
  it("Bedrock and Lambda: not verified, planned only, never claimed", () => {
    for (const q of ["Does Aziz use Bedrock or Lambda?", "Does Aziz use Bedrock?", "Is AWS Lambda connected?", "Is there an API Gateway?"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).toBe("not_verified");
      expect(a.answer, q).toContain("Not verified");
      expect(all(a), q).not.toMatch(/is recorded as connected/);
      expect(a.limitations.join(" "), q).toContain("not proof of absence");
    }
  });
  it("tools: every listed domain cites where it was used", () => {
    const a = bot.ask("What tools did Aziz use?");
    expect(a.outcome).toBe("supported");
    expect(a.evidence.length).toBe(portfolio.skills.filter((s) => s.icon !== "toolkit").length);
    expect(a.evidence.every((e) => e.url.startsWith("https://github.com/"))).toBe(true);
  });
  it("limitations: lists limits of all three projects", () => {
    const a = bot.ask("What are the limitations of the results?");
    expect(a.intent).toBe("limitations");
    const t = a.limitations.join("\n");
    ["TraffiX:", "FlyRank:", "HR document checks:", "ALIA:"].forEach((x) => expect(t).toContain(x));
  });
  it("interview: suggested questions tied to passages, labelled as not claims", () => {
    const a = bot.ask("What should I ask Aziz in an interview?");
    expect(a.intent).toBe("interview");
    expect(a.answer).toContain("ambulance");
    expect(a.limitations.join(" ")).toContain("not claims");
  });
});

describe("ALIA: an NDA project, described only as far as my own account goes", () => {
  it.each([
    ["What is ALIA?", /practice conversations|avatar/i],
    ["what did you do at vital laboratories", /fallback|debrief/i],
    ["what did aziz build in alia", /fallback|debrief/i],
    ["has alia been tested with real users", /not been evaluated/i],
    ["tell me about the avatar project", /avatar/i],
  ])("%j", (q, text) => {
    const a = bot.ask(q);
    expect(["supported", "contradicted"], q).toContain(a.outcome);
    expect(a.passageIds.some((id) => id.startsWith("al-")), q).toBe(true);
    expect([a.answer, ...a.limitations].join(" "), q).toMatch(text);
    expect(a.evidence.length, q).toBeGreaterThan(0);
  });
  it("states the NDA and the team split, and never invents a score or a result", () => {
    const all = ["What is ALIA?", "what did aziz build in alia", "how well did alia score", "what accuracy did alia get", "how many users does alia have"].map((q) => bot.ask(q));
    const text = all.map((a) => [a.answer, ...a.limitations].join(" ")).join(" ");
    expect(text).toMatch(/NDA/);
    expect(text).toMatch(/team/i);
    expect(text).not.toMatch(/\b9\d\b|%|out of 100|users? (love|like)/i);
  });
});

describe("outcomes stay distinct", () => {
  it("contradicted (the evidence says no) is not the same as not_verified (no evidence)", () => {
    expect(bot.ask("Is TraffiX deployed in Tunis?").outcome).toBe("contradicted");
    expect(bot.ask("Is TraffiX deployed in Tunis?").answer).toContain("not deployed on any street");
    expect(bot.ask("What is your IQ?").outcome).toBe("not_verified");
    expect(bot.ask("Do you know Kubernetes?").outcome).toBe("not_verified");
  });
  it("no evidence: refuses to guess and says what it can answer", () => {
    const a = bot.ask("What is your favourite colour?");
    expect(a.outcome).toBe("not_verified");
    expect(a.answer).toContain("won't guess");
    expect(a.evidence).toEqual([]);
  });
  it("invalid input is an error, not a guess", () => {
    expect(bot.ask("   ").outcome).toBe("error");
    const long = bot.ask("x".repeat(MAX_QUESTION + 1));
    expect(long.outcome).toBe("error");
    expect(long.answer).toContain(String(MAX_QUESTION));
  });
  it("`ask` prefix and bare questions give the same answer", () => {
    expect(bot.ask("ask What did Aziz build in TraffiX?")).toEqual(bot.ask("What did Aziz build in TraffiX?"));
  });
  it("every supported or contradicted answer cites at least one specific source", () => {
    for (const q of ["What did Aziz build in TraffiX?", "Did TraffiX make ambulances faster?", "What is Precision@50?", "How did you avoid data leakage?", "What is the OCR accuracy on real documents?", "What are Aziz's certifications?"]) {
      const a = bot.ask(q);
      expect(["supported", "contradicted"], q).toContain(a.outcome);
      expect(a.evidence.length, q).toBeGreaterThan(0);
      expect(a.evidence.every((e) => /^(https:\/\/|mailto:)/.test(e.url)), q).toBe(true);
    }
  });
});

describe("AWS claims follow the evidence file, nothing else", () => {
  it("a recorded deployment needs a URL and a build record; it still does not imply services", () => {
    const deployed = createAssistant(corpus, { ...portfolio, aws: { ...portfolio.aws, deployed: true, liveUrl: "https://main.example.amplifyapp.com", buildRecord: "Amplify console, build #1 succeeded" } });
    const a = deployed.ask("What is the AWS hosting status?");
    expect(a.outcome).toBe("supported");
    expect(a.answer).toContain("https://main.example.amplifyapp.com");
    expect(a.answer).toContain("Build record");
    expect(deployed.ask("Does Aziz use Bedrock?").outcome).toBe("not_verified");
  });
  it("a service counts only when it is listed as connected with evidence", () => {
    const wired = createAssistant(corpus, { ...portfolio, aws: { ...portfolio.aws, connected: [{ name: "Amazon Bedrock", evidence: "https://github.com/azizmessaoud/aws-superpower-portfolio/blob/main/README.md" }] } });
    const a = wired.ask("Does Aziz use Bedrock?");
    expect(a.outcome).toBe("supported");
    expect(urls(a)[0]).toContain("README.md");
  });
  it("an AWS certification is claimed only if it is in the verified list", () => {
    expect(bot.ask("Does Aziz have an AWS certification?").outcome).toBe("not_verified");
    const withAws = createAssistant(corpus, { ...portfolio, certifications: [...portfolio.certifications, { kind: "main", issuer: "AWS", title: "Cloud Practitioner", detail: "AWS Certified Cloud Practitioner", year: "2026", href: "https://example.com/verify" }] });
    const a = withAws.ask("Does Aziz have an AWS certification?");
    expect(a.outcome).toBe("supported");
    expect(a.answer).toContain("Cloud Practitioner");
  });
  it("the fallback works with no backend: no network API is touched while answering", () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (() => { calls++; throw new Error("network used"); }) as typeof fetch;
    try { bot.ask("What did Aziz build in TraffiX?"); bot.ask("What is the AWS hosting status?"); } finally { globalThis.fetch = real; }
    expect(calls).toBe(0);
  });
});

describe("Samsung Innovation Campus and MelanoVision", () => {
  it("the bootcamp questions find the certificate and say what the link is", () => {
    for (const q of ["Did he do the Samsung bootcamp?", "is aziz samsung certified", "samsung innovation campus"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).toBe("supported");
      expect(all(a), q).toContain("Samsung");
      expect(all(a), q).toMatch(/certificate image|completion/);
    }
  });
  it("MelanoVision: his part is the data, never the model", () => {
    for (const q of ["did aziz train the melanoma model?", "what did aziz do in melanovision", "what was his role in the melanoma project"]) {
      const a = bot.ask(q);
      expect(a.outcome, q).not.toBe("not_verified");
      expect(all(a), q).toMatch(/dataset integration and analysis/);
      expect(all(a), q).toMatch(/did not build the model|not build the model/);
    }
  });
  it("MelanoVision: no accuracy is claimed", () => {
    const a = bot.ask("How accurate is the melanoma detection?");
    expect(all(a)).toMatch(/no accuracy|no evaluation results|publishes no/i);
    expect(all(a)).not.toMatch(/92\.1|saves lives|%/);
  });
  it("Django and Next.js stay unclaimed as his tools", () => {
    expect(bot.ask("does he know Django?").outcome).not.toBe("supported");
  });
});
