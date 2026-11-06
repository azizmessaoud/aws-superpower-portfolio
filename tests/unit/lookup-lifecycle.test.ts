import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createAssistant } from "../../src/assistant/answer";
import { SAMPLES } from "../../src/assistant/samples";
import type { Corpus, Portfolio } from "../../src/content/schema";
import { validateAnswer, validateQuery } from "../../src/retrieval/contracts";
import { createSession, type Engine } from "../../src/retrieval/session";

/* The lookup lifecycle: loading, failure, retry, cancel, timeout. A fake clock replaces real timers, so nothing here waits. */
const corpus = JSON.parse(readFileSync("src/generated/corpus.json", "utf8")) as Corpus;
const portfolio = JSON.parse(readFileSync("src/generated/portfolio.json", "utf8")) as Portfolio;
const bot = createAssistant(corpus, portfolio);
const real: Engine = (q) => bot.ask(q);

function clock() {
  let t = 0, id = 0;
  const queue: { at: number; fn: () => void; id: number }[] = [];
  return {
    now: () => t,
    timers: {
      set: (fn: () => void, ms: number) => { const h = { at: t + ms, fn, id: ++id }; queue.push(h); return h; },
      clear: (h: unknown) => { const i = queue.indexOf(h as (typeof queue)[number]); if (i >= 0) queue.splice(i, 1); },
    },
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const next = queue[0];
        if (!next || next.at > end) break;
        queue.shift(); t = next.at; next.fn();
        await Promise.resolve();
      }
      t = end;
      await Promise.resolve();
    },
  };
}
const make = (engine: Engine, extra: Partial<Parameters<typeof createSession>[0]> = {}) => {
  const c = clock();
  return { c, s: createSession({ engine, now: c.now, timers: c.timers, ...extra }) };
};

describe("validateQuery", () => {
  it("rejects whitespace-only and over-long questions before any lookup", () => {
    expect(validateQuery("   ").ok).toBe(false);
    expect(validateQuery("x".repeat(201)).ok).toBe(false);
    expect(validateQuery("  what   is   FlyRank ")).toEqual({ ok: true, text: "what is FlyRank" });
  });
});

describe("validateAnswer", () => {
  const good = { outcome: "supported", intent: "x", title: "T", answer: "A", evidence: [{ label: "L", url: "https://example.com" }], limitations: [] };
  it("accepts a sourced answer", () => expect(validateAnswer(good).ok).toBe(true));
  it("rejects malformed data", () => expect(validateAnswer({ outcome: "supported", title: 12 }).ok).toBe(false));
  it("rejects a factual answer with no source", () => {
    expect(validateAnswer({ ...good, evidence: [] }).ok).toBe(false);
    expect(validateAnswer({ ...good, outcome: "contradicted", evidence: [] }).ok).toBe(false);
  });
  it("allows 'not verified' without a source, because it makes no claim", () => expect(validateAnswer({ ...good, outcome: "not_verified", evidence: [] }).ok).toBe(true));
  it("rejects a source link that is not https or mailto", () => expect(validateAnswer({ ...good, evidence: [{ label: "L", url: "javascript:alert(1)" }] }).ok).toBe(false));
});

describe("the real engine passes the contract", () => {
  const questions = [...SAMPLES, "Did TraffiX make ambulances faster?", "Is TraffiX deployed in Tunis?", "Does Aziz use Bedrock?", "What is FlyRank?", "What are the HR document checks?",
    "Which certifications does Aziz have?", "Where did Aziz do internships?", "What languages does Aziz speak?", "How do I contact Aziz?", "What tools does Aziz use?", "help", "hello",
    "What is your favourite colour?", "limits", "What is the AWS hosting status?", "Does Aziz know Docker?", "Tell me about ALIA", "who is aziz", "wat did u build"];
  for (const q of questions) it(`"${q}"`, () => {
    const v = validateAnswer(bot.ask(q));
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
  });
});

describe("the lookup session", () => {
  it("shows retrieving for the dwell time, then the answer", async () => {
    const { c, s } = make(real);
    expect(s.submit("What is FlyRank?")).toBe("started");
    expect(s.getState().phase).toBe("retrieving");
    await c.advance(699); expect(s.getState().phase).toBe("retrieving");
    await c.advance(2); expect(s.getState().phase).toBe("results");
    expect(s.getState().answer?.outcome).toBe("supported");
  });

  it("turns a throwing lookup into a failure that keeps the question, and retry repeats it", async () => {
    let calls = 0;
    const { c, s } = make((q) => { calls += 1; if (calls === 1) throw new Error("boom"); return real(q); });
    s.submit("What is FlyRank?");
    await c.advance(800);
    expect(s.getState().phase).toBe("error");
    expect(s.getState().failure).toMatchObject({ cause: "exception", query: "What is FlyRank?" });
    expect(s.retry()).toBe(true);
    await c.advance(800);
    expect(s.getState().phase).toBe("results");
    expect(s.getState().retried).toBe(true);
    expect(calls).toBe(2);
  });

  it("refuses malformed and unsourced lookups instead of showing them", async () => {
    const bad = make(() => ({ outcome: "supported", title: 12 }));
    bad.s.submit("anything"); await bad.c.advance(800);
    expect(bad.s.getState().failure?.cause).toBe("malformed");
    const bare = make((q) => ({ ...(real(q) as object), outcome: "supported", evidence: [] }));
    bare.s.submit("What is FlyRank?"); await bare.c.advance(800);
    expect(bare.s.getState().failure?.cause).toBe("malformed");
    expect(bare.s.getState().answer).toBeUndefined();
  });

  it("says it is still working, then gives up with a timeout instead of loading forever", async () => {
    const { c, s } = make(() => new Promise(() => {}), { slowAfterMs: 1500, timeoutMs: 5000 });
    s.submit("What is FlyRank?");
    await c.advance(1600); expect(s.getState().slow).toBe(true);
    await c.advance(3500); expect(s.getState().phase).toBe("error");
    expect(s.getState().failure?.cause).toBe("timeout");
  });

  it("cancels, and ignores the late answer", async () => {
    let release: (v: unknown) => void = () => {};
    const { c, s } = make(() => new Promise((r) => { release = r; }));
    s.submit("What is FlyRank?");
    expect(s.cancel()).toBe(true);
    expect(s.getState().phase).toBe("idle");
    release(real("What is FlyRank?")); await c.advance(800);
    expect(s.getState().phase).toBe("idle");
  });

  it("rate-limits a quick second question; a later one supersedes the lookup in flight", async () => {
    const { c, s } = make(real);
    s.submit("What is FlyRank?");
    expect(s.submit("What is ALIA?")).toBe("rate-limited");
    await c.advance(650);
    expect(s.getState().phase).not.toBe("results");
    expect(s.submit("What is ALIA?")).toBe("started");
    await c.advance(800);
    expect(s.getState().phase).toBe("results");
    expect(s.getState().query).toBe("What is ALIA?");
    await c.advance(800);
    const quick = make(real, { minDwellMs: 0 });
    quick.s.submit("What is FlyRank?"); await quick.c.advance(10);
    expect(quick.s.submit("What is ALIA?")).toBe("rate-limited");
  });

  it("flags an empty question as invalid without running a lookup", () => {
    let calls = 0;
    const { s } = make((q) => { calls += 1; return real(q); });
    expect(s.submit("   ")).toBe("invalid");
    expect(s.getState().phase).toBe("invalid");
    expect(calls).toBe(0);
  });
});
