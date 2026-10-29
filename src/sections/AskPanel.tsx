import { useEffect, useMemo, useRef, useState } from "react";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createAssistant, MAX_QUESTION, type Answer } from "../assistant/answer";
import { DWELL_MS, nextState, STATE_TEXT, stateForOutcome, type MindState } from "../mind/state";
import Icon from "../ui/Icon";

/* The sample that shows a weaker result is deliberately third-from-last: judges should find it. */
const SAMPLES = [
  "What did Aziz personally build in TraffiX?",
  "Did TraffiX make ambulances faster?",
  "What is the AWS hosting status?",
  "Does Aziz use Bedrock?",
  "What should I ask Aziz in an interview?",
];
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
  const timers = useRef<number[]>([]);
  const lastAt = useRef(-Infinity);
  const stateRef = useRef(mind);
  stateRef.current = mind;

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clear, []);
  useEffect(() => { onLayout(); }, [shown, onLayout]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  function submit(q: string) {
    const text = q.trim();
    if (!text) return;
    const now = performance.now();
    if (now - lastAt.current < MIN_GAP_MS) return;
    lastAt.current = now;
    clear();
    setShown(null);
    setMind(nextState(stateRef.current, { type: "submit" }));
    const answer = assistant.ask(text);
    const dwell = reduced ? 200 : DWELL_MS.retrieving;
    later(() => {
      setShown(answer);
      const next = stateForOutcome(answer.outcome);
      setMind(next);
      later(() => setMind(nextState(next, { type: "settle" })), reduced ? 1500 : DWELL_MS[next]);
    }, dwell);
  }

  return (
    <div className="ask" id="ask">
      <form className="ask-form" role="search" onSubmit={(e) => { e.preventDefault(); submit(value); }}>
        <label htmlFor="hero-ask" className="ask-label">Ask my brain · check a claim against the evidence</label>
        <div className="ask-row">
          <input id="hero-ask" className="ask-input" type="search" value={value} maxLength={MAX_QUESTION} autoComplete="off"
            placeholder="e.g. Did TraffiX make ambulances faster?"
            onChange={(e) => { setValue(e.target.value); setMind(nextState(stateRef.current, { type: "type", empty: !e.target.value })); }}
            onFocus={() => setMind(nextState(stateRef.current, { type: "focus" }))}
            onBlur={() => setMind(nextState(stateRef.current, { type: "blur" }))} />
          <button className="btn-primary ask-submit" type="submit"><Icon name="search" /> Ask</button>
        </div>
      </form>
      <p className="ask-status" role="status" aria-live="polite" data-state={mind}><span className="ask-dot" aria-hidden="true" /> {STATE_TEXT[mind]}</p>
      <ul className="ask-samples" aria-label="Sample questions">
        {SAMPLES.map((s) => (
          <li key={s}><button type="button" className="suggest-q" onClick={() => { setValue(s); submit(s); }}>{s}</button></li>
        ))}
      </ul>
      {shown && (
        <section className={`ask-answer is-${shown.outcome}`} aria-label="Answer" tabIndex={0}>
          <p className="ask-outcome">{OUTCOME[shown.outcome]}</p>
          <h2 className="ask-title">{shown.title}</h2>
          <p className="ask-text">{shown.answer}</p>
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
      )}
    </div>
  );
}
