/* The retrieval lifecycle as a small framework-free state machine.
 *
 *   idle ──submit──▶ submitted ──▶ retrieving ──▶ results   (an answer; a "not verified" answer is still an answer)
 *     ▲                  │              └──────▶ error     (the lookup threw, returned bad data, or never answered)
 *     └────────────── invalid           └─cancel─▶ idle (or back to error when cancelling a retry)
 *
 * `invalid` is raised before any lookup (whitespace-only, too long). The engine is injected and may be synchronous or
 * return a promise. Today it is the deterministic in-browser engine, so nothing here touches a network; the same seams
 * (timeout, stale-response guard, retry) are what a future remote retriever would need, and tests exercise them by
 * injecting a failing, slow or malformed engine. */
import type { Answer } from "../assistant/answer";
import { validateAnswer, validateQuery, type RetrievalFailure, type ValidationFailure } from "./contracts";

export type Phase = "idle" | "submitted" | "retrieving" | "results" | "invalid" | "error";
export type Engine = (query: string) => unknown;
export interface Timers { set(fn: () => void, ms: number): unknown; clear(handle: unknown): void }

export interface SessionOptions {
  engine: Engine;
  /** Shortest time `retrieving` stays visible, so a fast local lookup is still readable. */
  minDwellMs?: number | (() => number);
  /** After this long a "still working" notice is announced. */
  slowAfterMs?: number;
  /** After this long the lookup is abandoned as a timeout failure, so loading never lasts forever. */
  timeoutMs?: number;
  /** One new question per interval; the limit an API throttle would impose if a backend is added later. */
  minGapMs?: number;
  now?: () => number;
  timers?: Timers;
}

export interface SessionState {
  phase: Phase;
  /** The last question that was actually sent (trimmed, whitespace collapsed). */
  query: string;
  answer?: Answer;
  failure?: RetrievalFailure;
  invalid?: ValidationFailure;
  /** How many lookups have been started, retries included. */
  attempt: number;
  slow: boolean;
  /** True when the current or last run was started by Retry, so the page can restore focus. */
  retried: boolean;
  /** Text for the polite status region when the generic state text is not enough. */
  announcement: string | null;
}

export type SubmitResult = "started" | "busy" | "rate-limited" | "invalid";

const FAILURE_MESSAGE: Record<RetrievalFailure["cause"], string> = {
  exception: "The lookup stopped with an error, so nothing was answered. This looks temporary.",
  malformed: "The lookup returned data this page cannot trust, so nothing is shown. No answer is better than an unsourced one.",
  timeout: "The lookup did not finish in time, so it was stopped. This looks temporary.",
};
const short = (s: string) => (s.length > 160 ? `${s.slice(0, 157)}…` : s);

export function createSession(opts: SessionOptions) {
  const { engine } = opts;
  const dwellOpt = opts.minDwellMs ?? 700;
  const minDwell = () => (typeof dwellOpt === "function" ? dwellOpt() : dwellOpt);
  const slowAfter = opts.slowAfterMs ?? 1500, timeout = opts.timeoutMs ?? 5000, minGap = opts.minGapMs ?? 600;
  const now = opts.now ?? (() => performance.now());
  const timers: Timers = opts.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

  let state: SessionState = { phase: "idle", query: "", attempt: 0, slow: false, retried: false, announcement: null };
  const listeners = new Set<() => void>();
  let reqId = 0;               /* a response only counts if its id is still current: cancel and timeout bump it */
  let lastAt = -Infinity;
  let pending: unknown[] = [];

  const set = (patch: Partial<SessionState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  const clearTimers = () => { pending.forEach((h) => timers.clear(h)); pending = []; };
  const busy = () => state.phase === "submitted" || state.phase === "retrieving";

  function fail(cause: RetrievalFailure["cause"], query: string, error?: unknown) {
    clearTimers();
    const detail = short(error instanceof Error ? error.message : error === undefined ? cause : String(error));
    set({ phase: "error", slow: false, answer: undefined, invalid: undefined,
      failure: { kind: "failure", cause, message: FAILURE_MESSAGE[cause], detail, query },
      announcement: "Retrieval failed. Your question is kept, and you can retry." });
  }

  function finish(query: string, outcome: { ok: true; value: unknown } | { ok: false; error: unknown }) {
    clearTimers();
    if (!outcome.ok) return fail("exception", query, outcome.error);
    const v = validateAnswer(outcome.value);
    if (!v.ok) return fail("malformed", query, v.reason);
    set({ phase: "results", slow: false, answer: v.answer, failure: undefined, invalid: undefined, announcement: null });
  }

  function begin(query: string, viaRetry: boolean) {
    const id = ++reqId;
    lastAt = now();
    set({ phase: "submitted", query, attempt: state.attempt + 1, slow: false, retried: viaRetry, announcement: null, invalid: undefined,
      /* a retry keeps the failure card on screen (its button shows progress); a new question clears the old view */
      ...(viaRetry ? {} : { answer: undefined, failure: undefined }) });
    let outcome: { ok: true; value: unknown } | { ok: false; error: unknown } | undefined;
    const dwell = minDwell();
    let dwellDone = dwell <= 0;
    const settle = () => { if (id === reqId && outcome && dwellDone) finish(query, outcome); };

    let result: unknown;
    try { result = engine(query); } catch (error) { result = Promise.reject(error); }
    set({ phase: "retrieving" });

    if (!dwellDone) pending.push(timers.set(() => { dwellDone = true; settle(); }, dwell));
    pending.push(timers.set(() => { if (id === reqId && busy()) set({ slow: true, announcement: "Still working. This is taking longer than usual." }); }, slowAfter));
    pending.push(timers.set(() => { if (id !== reqId || !busy()) return; reqId++; fail("timeout", query); }, timeout));

    Promise.resolve(result).then(
      (value) => { outcome = { ok: true, value }; settle(); },
      (error) => { outcome = { ok: false, error }; settle(); },
    );
  }

  return {
    getState: () => state,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },

    /** Ask a new question. Quick repeats are rate-limited; a question asked after the gap while another is in flight supersedes it
     * (the old response is ignored), as the question box always behaved. */
    submit(raw: string): SubmitResult {
      const q = validateQuery(raw);
      if (!q.ok) { set({ phase: "invalid", invalid: q.failure, announcement: q.failure.message }); return "invalid"; }
      if (now() - lastAt < minGap) return "rate-limited";
      clearTimers();
      begin(q.text, false);
      return "started";
    },

    /** Repeat exactly the question that failed. A no-op while a lookup is in flight or when nothing failed. */
    retry(): boolean {
      if (busy() || !state.failure) return false;
      begin(state.failure.query, true);
      return true;
    },

    /** Abandon the lookup in flight. Its late response is ignored. The typed question is not touched. */
    cancel(): boolean {
      if (!busy()) return false;
      reqId++;
      clearTimers();
      set({ phase: state.failure ? "error" : "idle", slow: false, announcement: "Cancelled. Your question is still in the box." });
      return true;
    },

    /** Drop pending timers (the component unmounted). */
    destroy() { reqId++; clearTimers(); listeners.clear(); },
  };
}
export type Session = ReturnType<typeof createSession>;
