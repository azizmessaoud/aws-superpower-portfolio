import { useEffect, useMemo, useRef, useState } from "react";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createAssistant, MAX_QUESTION, type Answer } from "../assistant/answer";
import { CONTRADICTION, presentAnswer, projectIdOf } from "../assistant/present";
import { DWELL_MS, nextState, STATE_TEXT, stateForOutcome, type MindState } from "../mind/state";
import Icon from "../ui/Icon";
import { CASES } from "./projects/summary";

/* The sample that shows a weaker result is deliberately third-from-last: judges should find it. */
const SAMPLES = [
  "What did Aziz personally build in TraffiX?",
  "Did TraffiX make ambulances faster?",
  "What is the AWS hosting status?",
  "Does Aziz use Bedrock?",
  "What should I ask Aziz in an interview?",
  "Where did Aziz do internships?",
];
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
/* One question per interval: the same limit an API Gateway throttle would impose if a backend is added later. */
const MIN_GAP_MS = 600;

interface Props { mind: MindState; setMind: (s: MindState) => void; reduced: boolean; onLayout: () => void }

/* The question box. The mind's state follows the question lifecycle (listening, retrieving, then answering or
 * uncertain) and is also written out as text, so the state is never conveyed by animation alone. */
export default function AskPanel({ mind, setMind, reduced, onLayout }: Props) {
  const assistant = useMemo(() => createAssistant(corpusJson as Corpus, portfolioJson as Portfolio), []);
  const [value, setValue] = useState("");
  const [shown, setShown] = useState<Answer | null>(null);
  const [answerNo, setAnswerNo] = useState(0); /* a new key per answer, so the card's entrance plays every time */
  const timers = useRef<number[]>([]);
  const lastAt = useRef(-Infinity);
  const lastAsked = useRef("");
  const stateRef = useRef(mind);
  stateRef.current = mind;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  useEffect(() => { onLayout(); }, [shown, onLayout]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  function submit(q: string) {
    const text = q.trim();
    if (!text) {
      /* an empty question gets the engine's own message, not silence */
      clear();
      setShown(assistant.ask("")); setAnswerNo((n) => n + 1);
      const next = stateForOutcome("error");
      setMind(next);
      later(() => setMind(nextState(next, { type: "settle" })), reduced ? 1500 : DWELL_MS[next]);
      return;
    }
    const now = performance.now();
    if (now - lastAt.current < MIN_GAP_MS) return;
    lastAt.current = now;
    lastAsked.current = text;
    clear();
    setShown(null);
    setMind(nextState(stateRef.current, { type: "submit" }));
    const answer = assistant.ask(text);
    const dwell = reduced ? 200 : DWELL_MS.retrieving;
    later(() => {
      setShown(answer); setAnswerNo((n) => n + 1);
      const next = stateForOutcome(answer.outcome);
      setMind(next);
      later(() => setMind(nextState(next, { type: "settle" })), reduced ? 1500 : DWELL_MS[next]);
    }, dwell);
  }

  return (
    <div className="ask" id="ask">
      <form className="ask-form" role="search" onSubmit={(e) => { e.preventDefault(); submit(value); }}>
        <label htmlFor="hero-ask" className="ask-label">Ask Aziz anything · answers come from checked evidence</label>
        <div className="ask-row">
          <input id="hero-ask" className="ask-input" type="search" value={value} maxLength={MAX_QUESTION} autoComplete="off"
            placeholder="e.g. Did TraffiX make ambulances faster?"
            onChange={(e) => { setValue(e.target.value); setMind(nextState(stateRef.current, { type: "type", empty: !e.target.value })); }}
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
      {shown && (() => {
        const pid = projectIdOf(shown);
        const pr = presentAnswer(shown, pid);
        const asked = lastAsked.current.toLowerCase();
        const next = pr.followUps.filter((f) => f.toLowerCase() !== asked);
        return (
        <section key={answerNo} className={`ask-answer is-${shown.outcome}`} aria-label="Answer" tabIndex={0}>
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
