/* Stress test for the question box: messy, real-world inputs, graded by CLASS of answer, not by exact wording.
 * Usage: npm run stress [-- --set heldout|tuning|all] [--check] [--out reports/stress-report.md]
 * --check exits non-zero when the acceptance bars are missed (used by CI-style runs and the unit test). */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { createAssistant, type Answer } from "../src/assistant/answer";
import type { Corpus, Portfolio } from "../src/content/schema";

type Cls = "answer" | "related" | "not_verified" | "out_of_scope" | "greet" | "clarify" | "error";
interface Case { cat: string; q: string; expect: Cls | Cls[]; intent?: string; passage?: string; parts?: string[]; chain?: string[] }
interface Row { set: string; c: Case; got: Cls; a: Answer; ok: boolean; why: string }

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(root + p, "utf8");
const corpus = JSON.parse(read("src/generated/corpus.json")) as Corpus;
const portfolio = JSON.parse(read("src/generated/portfolio.json")) as Portfolio;

export function classOf(a: Answer): Cls {
  if (a.intent === "greeting") return "greet";
  if (a.intent === "clarify") return "clarify";
  if (a.outcome === "supported" || a.outcome === "contradicted") return "answer";
  return a.outcome as Cls;
}

export function runSet(set: string, cases: Case[]): Row[] {
  const bot = createAssistant(corpus, portfolio) as unknown as { ask: (q: string, ctx?: unknown) => Answer & { next?: unknown } };
  return cases.map((c) => {
    let ctx: unknown, a!: Answer & { next?: unknown };
    for (const q of [...(c.chain ?? []), c.q]) { a = bot.ask(q, ctx); ctx = a.next; }
    const got = classOf(a);
    const want = ([] as Cls[]).concat(c.expect);
    const why: string[] = [];
    if (!want.includes(got)) why.push(`class ${got}, wanted ${want.join("|")}`);
    if (c.intent && a.intent !== c.intent && !((a as { parts?: Answer[] }).parts ?? []).some((p) => p.intent === c.intent)) why.push(`intent ${a.intent}, wanted ${c.intent}`);
    if (c.passage && !(a.passageIds ?? []).includes(c.passage)) why.push(`passages [${(a.passageIds ?? []).join(",")}], wanted ${c.passage}`);
    if (c.parts) {
      const got = ((a as { parts?: Answer[] }).parts ?? []).map((p) => p.intent);
      if (!c.parts.every((p) => got.includes(p))) why.push(`parts [${got.join(",")}], wanted ${c.parts.join("+")}`);
    }
    return { set, c, got, a, ok: why.length === 0, why: why.join("; ") };
  });
}

const SAFE = new Set<Cls>(["not_verified", "out_of_scope", "greet", "clarify", "related"]);
/** The dangerous failure: a real-looking answer to something that should have been refused, greeted or clarified. */
const falseSupport = (r: Row) => r.got === "answer" && !([] as Cls[]).concat(r.c.expect).includes("answer") && !([] as Cls[]).concat(r.c.expect).includes("related");

export function summarise(rows: Row[]) {
  const cats = [...new Set(rows.map((r) => r.c.cat))];
  const byCat = cats.map((cat) => { const rs = rows.filter((r) => r.c.cat === cat); return { cat, n: rs.length, pass: rs.filter((r) => r.ok).length }; });
  const inScope = rows.filter((r) => ([] as Cls[]).concat(r.c.expect).includes("answer"));
  const refuse = rows.filter((r) => !([] as Cls[]).concat(r.c.expect).includes("answer"));
  return {
    byCat, total: rows.length, pass: rows.filter((r) => r.ok).length,
    inScopePass: inScope.filter((r) => r.ok).length, inScopeN: inScope.length,
    falseSupport: rows.filter(falseSupport),
    refusalOk: refuse.filter((r) => SAFE.has(r.got) && !falseSupport(r)).length, refusalN: refuse.length,
    failures: rows.filter((r) => !r.ok),
  };
}

export function report(label: string, rows: Row[]): string {
  const s = summarise(rows);
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 100);
  const out = [`## ${label}`, "",
    `Cases: ${s.total} · passed ${s.pass} (${pct(s.pass, s.total)}%)`,
    `In-scope answers routed correctly: ${s.inScopePass}/${s.inScopeN} (${pct(s.inScopePass, s.inScopeN)}%)`,
    `Refusals, greetings and clarifications handled safely: ${s.refusalOk}/${s.refusalN} (${pct(s.refusalOk, s.refusalN)}%)`,
    `**False support** (a real-looking answer where none was right): ${s.falseSupport.length}`, "",
    "| category | cases | passed |", "|---|---:|---:|", ...s.byCat.map((c) => `| ${c.cat} | ${c.n} | ${c.pass} |`), ""];
  if (s.falseSupport.length) out.push("### False support", "", ...s.falseSupport.map((r) => `- \`${r.c.q}\` → ${r.a.intent}/${r.a.outcome}: ${r.a.title}`), "");
  if (s.failures.length) out.push("### All failures", "", ...s.failures.map((r) => `- [${r.c.cat}] \`${r.c.q}\`${r.c.chain ? ` (after ${r.c.chain.length} earlier)` : ""} → ${r.a.intent}/${r.a.outcome}: ${r.a.title} — ${r.why}`), "");
  return out.join("\n");
}

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const which = arg("--set") ?? "all";
  const load = (f: string) => parse(read(f)) as Case[];
  const sets: Record<string, Case[]> = {};
  const want = (n: string) => which === "all" || which === n;
  for (const n of ["heldout", "heldout2", "heldout3", "heldout4", "tuning"]) if (want(n)) { try { sets[n] = load(`tests/stress/${n}.yaml`); } catch { /* set not written yet */ } }
  const md = ["# Question box stress test", "", `Run: ${new Date().toISOString().slice(0, 10)} · engine: deterministic browser retriever · cases were written by me, not by visitors (see WRITEUP).`, ""];
  let bad = false;
  for (const [name, cases] of Object.entries(sets)) {
    const rows = runSet(name, cases);
    const text = report(name, rows);
    console.log(text); md.push(text);
    const s = summarise(rows);
    if (name.startsWith("heldout") && (s.falseSupport.length > 0 || s.inScopePass / Math.max(1, s.inScopeN) < 0.9)) bad = true;
  }
  const out = arg("--out");
  if (out) { mkdirSync(root + out.split("/").slice(0, -1).join("/"), { recursive: true }); writeFileSync(root + out, md.join("\n")); }
  if (process.argv.includes("--check") && bad) { console.error("\nSTRESS CHECK FAILED: held-out bars not met"); process.exit(1); }
}
