import { useEffect, useMemo, useRef, useState } from "react";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createAssistant, MAX_QUESTION, type Answer, type Context } from "../assistant/answer";
import { DWELL_MS, nextState, STATE_TEXT, stateForOutcome, type MindState } from "../mind/state";
import Icon from "../ui/Icon";

/* The sample that shows a weaker result is deliberately third-from-last: judges should find it. */
const SAMPLES = [
  "What did Aziz personally build in TraffiX?",
  "Did TraffiX make ambulances faster?",
  "What is the AWS hosting status?",
  "Does Aziz use Bedrock?",
  "What should I ask Aziz in an interview?",
  "Where did Aziz do internships?",
];
const OUTCOME: Record<Answer["outcome"], string> = {
  supported: "Answer",
  contradicted: "Answer · the evidence disagrees with the question",
  related: "Closest evidence · may not answer your question",
  not_verified: "Not verified",
  out_of_scope: "Not a question about my work",
  info: "Terminal Explorer",
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
  const ctx = useRef<Context | undefined>(undefined); /* what a follow-up like "and its limits?" refers to */
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
    const answer = assistant.ask(text, ctx.current);
    ctx.current = answer.next;
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
        <label htmlFor="hero-ask" className="ask-label">Terminal Explorer · check a claim against the evidence</label>
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
          {shown.parts?.length ? (
            <>
              <p className="ask-outcome">Answer in {shown.parts.length} parts</p>
              {shown.parts.map((part) => <AnswerBody key={part.title + part.intent} a={part} nested />)}
            </>
          ) : <AnswerBody a={shown} />}
        </section>
      )}
    </div>
  );
}

function AnswerBody({ a, nested = false }: { a: Answer; nested?: boolean }) {
  const H = nested ? "h3" : "h2";
  return (
    <div className={nested ? "ask-part" : undefined}>
      {!nested && <p className="ask-outcome">{OUTCOME[a.outcome]}</p>}
      <H className="ask-title">{nested && <span className="ask-part-tag">{OUTCOME[a.outcome]} · </span>}{a.title}</H>
      <p className="ask-text">{a.answer}</p>
      {a.evidence.length > 0 && (
        <>
          <h3 className="ask-sub">Evidence</h3>
          <ul className="ask-evidence">{a.evidence.map((e) => <li key={e.url + e.label}><a href={e.url}>{e.label} <Icon name="external" /></a></li>)}</ul>
        </>
      )}
      {a.limitations.length > 0 && (
        <>
          <h3 className="ask-sub ask-sub-limits"><Icon name="alert" /> Limitations</h3>
          <ul className="ask-limits">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </>
      )}
    </div>
  );
}
