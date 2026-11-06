import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createAssistant, MAX_QUESTION, type Answer } from "../assistant/answer";
import { CONTRADICTION, presentAnswer, projectIdOf } from "../assistant/present";
import { SAMPLES } from "../assistant/samples";
import { DWELL_MS, nextState, STATE_TEXT, stateForOutcome, type MindState } from "../mind/state";
import { faultFromUrl, withFault } from "../dev/sabotage";
import { createSession, type Engine, type Phase } from "../retrieval/session";
import type { ActionState } from "../ui/ActionButton";
import Icon from "../ui/Icon";
import { ResultSkeleton, RetrievalErrorCard } from "../ui/retrieval";
import { CASES } from "./projects/summary";

/* Which flagship project an answer is about, read from the sources it cites. No match: no link. */
const REPO_OF: Record<(typeof CASES)[number]["id"], string> = { traffix: "/azizmessaoud/traffix/", flyrank: "/azizmessaoud/flyrank/", hr: "/azizmessaoud/hr-anomaly-detection/" };
export function projectOf(a: Answer) {
  return CASES.find((c) => a.evidence.some((e) => e.url.includes(REPO_OF[c.id])));
}
/* The icon beside the verdict: the verdict is also in words, so colour and icon are never the only signal. */
const VERDICT_ICON: Record<Answer["outcome"], "check" | "alert" | "search" | "close"> = { supported: "check", contradicted: "alert", not_verified: "search", error: "close" };
const OUTCOME: Record<Answer["outcome"], string> = {
  supported: "Answer",
  contradicted: "Answer · the evidence disagrees with the question",
  not_verified: "Not verified",
  error: "Could not answer",
};
interface Props { mind: MindState; setMind: (s: MindState) => void; reduced: boolean; onLayout: () => void }

/* The question box. The mind's state follows the question lifecycle (listening, retrieving, then answering or
 * uncertain) and is also written out as text, so the state is never conveyed by animation alone. */
export default function AskPanel({ mind, setMind, reduced, onLayout }: Props) {
  const assistant = useMemo(() => createAssistant(corpusJson as Corpus, portfolioJson as Portfolio), []);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  /* Fault injection exists only in `npm run dev` and the e2e build; the production build compiles this to `null`. */
  const injected = import.meta.env.DEV || import.meta.env.MODE === "e2e" ? faultFromUrl() : null;
  /* A retrieval session owns the lifecycle: the lookup, its dwell, the slow notice, the timeout, retry and cancel. One question per
   * 600 ms, the limit an API Gateway throttle would impose if a backend is added later. This component only renders it. */
  const session = useMemo(() => {
    const base: Engine = (q) => assistant.ask(q);
    return createSession({
      engine: injected ? withFault(base, injected.fault) : base,
      minDwellMs: () => (reducedRef.current ? 200 : DWELL_MS.retrieving),
      timeoutMs: injected?.timeoutMs,
    });
  }, [assistant, injected?.fault, injected?.timeoutMs]);
  useEffect(() => () => session.destroy(), [session]);
  const snap = useSyncExternalStore(session.subscribe, session.getState);
  const busy = snap.phase === "submitted" || snap.phase === "retrieving";

  const [value, setValue] = useState("");
  /* an empty question gets the engine's own message at once, not silence; it is not a lookup, so it lives outside the session */
  const [emptyCard, setEmptyCard] = useState<Answer | null>(null);
  const [answerNo, setAnswerNo] = useState(0); /* a new key per answer, so the card's entrance plays every time */
  const input = useRef<HTMLInputElement>(null);
  const answerRef = useRef<HTMLElement>(null);
  const timers = useRef<number[]>([]);
  const lastAsked = useRef("");
  const stateRef = useRef(mind);
  stateRef.current = mind;
  const prevPhase = useRef<Phase>("idle");

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const shown: Answer | null = emptyCard ?? (snap.phase === "results" ? snap.answer ?? null : null);
  useEffect(() => { onLayout(); }, [shown, snap.phase, snap.failure, snap.slow, onLayout]);

  /* Map the lifecycle onto the mind's state, which is also written out as text. */
  useEffect(() => {
    const was = prevPhase.current, p = snap.phase;
    prevPhase.current = p;
    if (p === was) return;
    const wasBusy = was === "submitted" || was === "retrieving";
    if (p === "submitted" || p === "retrieving") {
      if (!wasBusy) { clear(); setMind(nextState(stateRef.current, { type: "submit" })); }
      return;
    }
    const settle = (s: MindState) => { setMind(s); later(() => setMind(nextState(s, { type: "settle" })), reducedRef.current ? 1500 : DWELL_MS[s]); };
    if (p === "results" && snap.answer) {
      setAnswerNo((n) => n + 1);
      settle(stateForOutcome(snap.answer.outcome));
      /* After a retry the focused Retry button is replaced by the answer: put focus on the answer, not on <body>. */
      if (snap.retried) later(() => answerRef.current?.focus({ preventScroll: true }), 0);
    } else if (p === "error") settle("error");
    else if (wasBusy && p === "idle") setMind("idle");            /* cancelled */
  }, [snap.phase, snap.answer, snap.retried, setMind]);

  function submit(q: string) {
    const text = q.trim();
    if (!text) {
      clear();
      setEmptyCard(assistant.ask("")); setAnswerNo((n) => n + 1);
      const next = stateForOutcome("error");
      setMind(next);
      later(() => setMind(nextState(next, { type: "settle" })), reducedRef.current ? 1500 : DWELL_MS[next]);
      return;
    }
    const r = session.submit(text);
    if (r === "started") { lastAsked.current = text; setEmptyCard(null); }
    if (r === "invalid") input.current?.focus();
  }
  const retryState: ActionState = busy ? "loading" : snap.phase === "error" && snap.retried ? "error" : "idle";

  return (
    <div className="ask" id="ask">
      <form className="ask-form" role="search" onSubmit={(e) => { e.preventDefault(); submit(value); }}>
        <label htmlFor="hero-ask" className="ask-label">Ask Aziz anything · answers come from checked evidence</label>
        <div className="ask-row">
          <input ref={input} id="hero-ask" className="ask-input" type="search" value={value} maxLength={MAX_QUESTION} autoComplete="off"
            placeholder="e.g. Did TraffiX make ambulances faster?"
            onChange={(e) => { setValue(e.target.value); setMind(nextState(stateRef.current, { type: "type", empty: !e.target.value })); }}
            onKeyDown={(e) => { if (e.key === "Escape" && busy) { e.preventDefault(); session.cancel(); } }}
            onFocus={() => setMind(nextState(stateRef.current, { type: "focus" }))}
            onBlur={() => setMind(nextState(stateRef.current, { type: "blur" }))} />
          <button className="btn-primary ask-submit" type="submit" aria-label="Ask" aria-busy={mind === "retrieving"} data-busy={mind === "retrieving"}>
            <span className="ask-submit-icon" aria-hidden="true"><Icon name="search" /></span>
            <span aria-hidden="true">{mind === "retrieving" ? "Searching" : "Ask"}</span>
          </button>
        </div>
      </form>
      <p className="ask-status" role="status" aria-live="polite" data-state={mind}><span className="ask-dot" aria-hidden="true" /> {STATE_TEXT[mind]}</p>
      <ul className="ask-samples" aria-label="Sample questions">
        {SAMPLES.map((s) => (
          <li key={s}><button type="button" className="suggest-q" onClick={() => { setValue(s); submit(s); }}>{s}</button></li>
        ))}
      </ul>
      <p className="ask-how">
        <span className="ask-how-long">Looked up in this site's checked evidence, not generated by a language model. Each answer links to its source; when nothing matches, it says so.</span>
        <span className="ask-how-short">Looked up, not generated by a language model.</span>
      </p>
      {busy && !snap.failure && <ResultSkeleton slow={snap.slow} onCancel={() => session.cancel()} />}
      {snap.failure && !emptyCard && (
        <RetrievalErrorCard failure={snap.failure} retryState={retryState} slow={snap.slow} sectionRef={answerRef}
          onRetry={() => session.retry()} onCancel={() => session.cancel()} />
      )}
      {shown && !snap.failure && (() => {
        const pid = projectIdOf(shown);
        const pr = presentAnswer(shown, pid);
        const asked = lastAsked.current.toLowerCase();
        const next = pr.followUps.filter((f) => f.toLowerCase() !== asked);
        return (
        <section ref={answerRef} key={answerNo} className={`ask-answer is-${shown.outcome}`} aria-label="Answer" tabIndex={0}>
          <p className="ask-outcome"><Icon name={VERDICT_ICON[shown.outcome]} /> {OUTCOME[shown.outcome]}</p>
          <h2 className="ask-title">{shown.title}</h2>
          {shown.outcome === "contradicted" && <p className="ask-premise"><Icon name="alert" /> {CONTRADICTION}</p>}
          {pr.points
            ? <ul className="ask-points">{pr.points.map((l) => <li key={l}>{l}</li>)}</ul>
            : <p className="ask-headline">{pr.headline}</p>}
          {shown.outcome !== "error" && (
            <ul className="ask-trust" aria-label="What backs this answer">
              <li><Icon name="check" /> {pr.sources} {pr.sources === 1 ? "source" : "sources"}</li>
              <li className={pr.limits ? "is-warn" : ""}><Icon name="alert" /> {pr.limits} {pr.limits === 1 ? "limit" : "limits"} noted</li>
              <li><Icon name="search" /> Looked up, not generated</li>
            </ul>
          )}
          {pr.detail && !pr.points && (
            <details className="ask-more">
              <summary>{pr.detail === shown.answer ? "Show the full text" : "Show the rest"}</summary>
              <p className="ask-text">{pr.detail}</p>
            </details>
          )}
          {next.length > 0 && (
            <>
              <h3 className="ask-sub">Ask next</h3>
              <ul className="ask-next">{next.map((f) => <li key={f}><button type="button" className="suggest-q" onClick={() => { setValue(f); submit(f); }}>{f}</button></li>)}</ul>
            </>
          )}
          {(() => { const p = projectOf(shown); return p && <p className="ask-open"><a href={`#project-${p.id}`}>Open the {p.title} case study <Icon name="arrow" /></a></p>; })()}
          {shown.evidence.length > 0 && (
            <>
              <h3 className="ask-sub">Evidence</h3>
              <ul className="ask-evidence">{shown.evidence.map((e) => <li key={e.url + e.label}><a href={e.url}>{e.label} <Icon name="external" /></a></li>)}</ul>
            </>
          )}
          {shown.limitations.length > 0 && (
            <>
              <h3 className="ask-sub ask-sub-limits"><Icon name="alert" /> Limitations</h3>
              <ul className="ask-limits">{shown.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
            </>
          )}
        </section>
        );
      })()}
    </div>
  );
}
