import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Corpus, Portfolio } from "../../src/content/schema";
import { COMMANDS, createTerminal } from "../../src/terminal/commands";

const portfolio = JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio;
const term = createTerminal(JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus, portfolio);
const links = (r: ReturnType<typeof term.run>) => (r === "clear" ? [] : r.filter((l) => l.kind === "link").map((l) => (l as { href: string }).href));
const text = (r: ReturnType<typeof term.run>) => (r === "clear" ? "clear" : r.map((l) => l.text).join("\n"));

describe("terminal explorer", () => {
  it("lists every command in help", () => {
    const out = text(term.run("help"));
    COMMANDS.forEach(([c]) => expect(out).toContain(c));
  });
  it("answers from the same retriever as Ask my brain, with limits and evidence", () => {
    const r = term.run("ask Are ambulances faster with TraffiX?");
    expect(text(r)).toContain("Ambulances are slower");
    expect(r !== "clear" && r.some((l) => l.kind === "link" && /github\.com\/azizmessaoud\/traffix/.test(l.href))).toBe(true);
  });
  it("refuses questions the evidence cannot answer", () => {
    expect(text(term.run("ask What is your IQ?"))).toContain("No verified passage");
  });
  it("shows a project's weak results next to its strong ones", () => {
    const out = text(term.run("project traffix"));
    expect(out).toContain("slower");
    expect(out).toContain("nothing significant");
    expect(out).toContain("Simulation only");
  });
  it("accepts aliases and is case-insensitive", () => {
    expect(text(term.run("PROJECT hr-docs"))).toContain("OCR accuracy on real documents has not been measured");
  });
  it("handles unknown commands and projects without throwing", () => {
    expect(text(term.run("sudo"))).toContain("command not found: sudo");
    expect(text(term.run("rm -rf /"))).not.toContain("command not found");
    expect(text(term.run("project nope"))).toContain("unknown project");
  });
  it("clears", () => expect(term.run("clear")).toBe("clear"));
});

describe("plain-language questions", () => {
  it.each(["whats aziz certifs", "what are Aziz's certifications?", "certs", "any badges?"])("answers %j with the verified credentials and their issuer links", (q) => {
    const r = term.run(q);
    expect(text(r)).toContain("OCI Data Science Professional");
    expect(links(r).length).toBe(portfolio.certifications.length);
    expect(links(r).every((h) => h.startsWith("https://"))).toBe(true);
  });
  it("filters by issuer", () => {
    const out = text(term.run("do you have an oracle certification?"));
    expect(out).toContain("OCI AI Foundations Associate");
    expect(out).not.toContain("Azure AI Fundamentals");
    expect(text(term.run("anything from azure"))).toContain("AI-901");
  });
  it("says plainly when a credential is not in the verified list", () => {
    const aws = text(term.run("do you have the AWS cloud practitioner certificate?"));
    expect(aws).toContain("can't verify");
    expect(aws).toContain("none is claimed");
    expect(text(term.run("are you google certified?"))).toContain("can't verify");
  });
  it("picks up a credential as soon as it is added to the list", () => {
    const extended = createTerminal(JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus, {
      ...portfolio,
      certifications: [
        ...portfolio.certifications,
        { kind: "main", issuer: "AWS", title: "Cloud Practitioner", detail: "AWS Certified Cloud Practitioner", year: "2026", href: "https://example.com/verify" },
      ],
    });
    const out = extended.run("do you have the AWS cloud practitioner certificate?");
    expect(text(out)).toContain("Cloud Practitioner");
    expect(text(out)).not.toContain("can't verify");
  });
  it("routes project and contact questions without the ask prefix", () => {
    expect(text(term.run("are ambulances faster with TraffiX?"))).toContain("Ambulances are slower");
    expect(text(term.run("how can I contact you?"))).toContain("aziz.messaoud@esprit.tn");
  });
  it("admits when nothing verified answers, and points to what it can answer", () => {
    const out = text(term.run("what is your favourite colour?"));
    expect(out).toContain("won't guess");
    expect(out).toContain("certifications");
  });
  it("prints the four-part label for a project", () => {
    const out = text(term.run("label flyrank"));
    ["Data", "How it was judged", "Where it fails", "Who reviews the output", "Observational, not causal"].forEach((t) => expect(out).toContain(t));
    expect(text(term.run("label nope"))).toContain("label needs a project");
  });
});

describe("small terminal behaviours", () => {
  it("labels each shorter credential as the course or certificate it is", () => {
    const out = text(term.run("certs"));
    expect(out).toContain("Hashgraph Developer · The Hashgraph Association · 2025 (certificate)");
    expect(out).toContain("Fundamentals of Deep Learning · NVIDIA · 2025 (Course)".replace("Course", "course"));
  });
  it("a single topic word answers from evidence, and a mistyped command still says command not found", () => {
    expect(text(term.run("ambulances"))).toContain("Ambulances are slower");
    expect(text(term.run("zzz"))).toContain("command not found: zzz");
    expect(term.lastOutcome).toBeUndefined();
  });
});

