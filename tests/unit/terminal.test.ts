import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Corpus } from "../../src/content/schema";
import { COMMANDS, createTerminal } from "../../src/terminal/commands";

const term = createTerminal(JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus);
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
    expect(text(term.run("rm -rf /"))).toContain("command not found: rm");
    expect(text(term.run("project nope"))).toContain("unknown project");
  });
  it("clears", () => expect(term.run("clear")).toBe("clear"));
});
