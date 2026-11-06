/* Contracts for the question → answer lifecycle.
 *
 * The answer engine (src/assistant/answer.ts) is deterministic and browser-only: no model, no network. These contracts do
 * not change that. They check what the engine returns before the page trusts it, and they define the technical failures
 * the page can show apart from "no evidence". No confidence value exists anywhere in them, on purpose. */
import { z } from "zod";
import { MAX_QUESTION, type Answer, type Outcome } from "../assistant/answer";

const OUTCOMES = ["supported", "contradicted", "not_verified", "error"] as const;
/** Outcomes that claim something about my work. Each must carry at least one source. */
export const FACTUAL: readonly Outcome[] = ["supported", "contradicted"];

const SourceRef = z.object({
  label: z.string().trim().min(1, "source has no label"),
  url: z.string().refine((u) => /^(https:\/\/|mailto:)/.test(u), "source link must be https or mailto"),
});

const RawAnswer = z.object({
  outcome: z.enum(OUTCOMES),
  intent: z.string().min(1),
  title: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  evidence: z.array(SourceRef),
  limitations: z.array(z.string()),
}).passthrough();

export type Validation = { ok: true; answer: Answer } | { ok: false; reason: string };

/** Reject malformed engine output, and any factual answer that arrives without its source. */
export function validateAnswer(raw: unknown): Validation {
  const parsed = RawAnswer.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, reason: `${first.path.join(".") || "answer"}: ${first.message}` };
  }
  const a = parsed.data;
  if (FACTUAL.includes(a.outcome) && a.evidence.length === 0)
    return { ok: false, reason: `a ${a.outcome} answer (“${a.title}”) carried no source metadata` };
  return { ok: true, answer: a as unknown as Answer };
}

export type RetrievalFailure = {
  kind: "failure";
  /** exception: the lookup threw. malformed: it returned something the contract rejects. timeout: it never answered. */
  cause: "exception" | "malformed" | "timeout";
  message: string;
  detail: string;
  /** The question that failed, so a retry repeats exactly it. */
  query: string;
};

export type ValidationFailure = { kind: "invalid"; reason: "empty" | "too_long"; message: string };

/** Check a typed question before any lookup. Whitespace-only counts as empty. */
export function validateQuery(raw: string): { ok: true; text: string } | { ok: false; failure: ValidationFailure } {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { ok: false, failure: { kind: "invalid", reason: "empty", message: "Type a question first. Spaces alone are not a question." } };
  if (text.length > MAX_QUESTION)
    return { ok: false, failure: { kind: "invalid", reason: "too_long", message: `Questions are limited to ${MAX_QUESTION} characters; this one has ${text.length}. Shorten it and ask again.` } };
  return { ok: true, text };
}
