import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { DWELL_MS, stateForOutcome, type MindState } from "../mind/state";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createTerminal, type Line } from "../terminal/commands";
import Icon from "../ui/Icon";

const PROMPT = "visitor@ask-my-brain:~$";
const TRY = [
  "help",
  "projects",
  "what are Aziz's certifications?",
  "label flyrank",
  "ask What did you personally build in the TraffiX team?",
  "ask Is TraffiX deployed in Tunis?",
  "ask How did you avoid data leakage?",
  "ask What is the OCR accuracy on real documents?",
];
type Entry = { id: number; cmd?: string; lines: Line[] };

/* The Terminal Explorer is "Ask my brain": questions and commands over the same verified passages.
 * Tab is never captured (no keyboard trap); ↑/↓ recall history; output is a polite live log. */
export default function Terminal({ setMind, reduced }: { setMind: (s: MindState) => void; reduced: boolean }) {
  const term = useMemo(() => createTerminal(corpusJson as Corpus, portfolioJson as Portfolio), []);
  const [log, setLog] = useState<Entry[]>([{ id: 0, lines: [{ kind: "muted", text: "Type help to see the commands, or try one below." }] }]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  function exec(cmd: string) {
    const out = term.run(cmd);
    const outcome = term.lastOutcome;
    if (outcome) {
      /* the same lifecycle the hero panel shows, so the docked brain reacts to terminal questions too */
      const next = stateForOutcome(outcome);
      setMind("retrieving");
      window.setTimeout(() => { setMind(next); window.setTimeout(() => setMind("idle"), reduced ? 1500 : DWELL_MS[next]); }, reduced ? 200 : DWELL_MS.retrieving);
    }
    if (out === "clear") setLog([]);
    else setLog((l) => [...l.slice(-30), { id: nextId.current++, cmd, lines: out }]);
    if (cmd.trim()) setHistory((h) => [cmd, ...h].slice(0, 30));
    setHIdx(-1);
    setValue("");
    requestAnimationFrame(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; });
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" && history.length) { e.preventDefault(); const i = Math.min(hIdx + 1, history.length - 1); setHIdx(i); setValue(history[i]); }
    else if (e.key === "ArrowDown" && hIdx >= 0) { e.preventDefault(); const i = hIdx - 1; setHIdx(i); setValue(i >= 0 ? history[i] : ""); }
  }

  return (
    <section id="terminal" className="section terminal-section" aria-labelledby="terminal-title">
      <div className="inner">
        <p className="sec-label">Command line</p>
        <h2 id="terminal-title" className="sec-h2">The same answers, as commands</h2>
        <p className="sec-lead">
          Ask about my projects with <code>ask</code> and your own words. It searches {corpusJson.passages.length} verified passages
          and shows the evidence behind each match, or says nothing verified answers it. It doesn't write answers and it
          doesn't judge anyone. Type <code>help</code> to see the other commands.
        </p>
        <div className="term-win" onClick={(e) => { if (!String(getSelection()) && !(e.target as Element).closest("a")) input.current?.focus(); }}>
          <div className="term-bar" aria-hidden="true">
            <span className="dot r" /><span className="dot y" /><span className="dot g" />
            <span className="term-title">ask-my-brain — terminal</span>
          </div>
          <div className="term-body" ref={body} role="log" aria-live="polite" aria-relevant="additions" aria-label="Terminal output">
            {log.map((entry) => (
              <div key={entry.id} className="term-entry">
                {entry.cmd !== undefined && <p className="t-line"><span className="t-prompt">{PROMPT}</span> {entry.cmd}</p>}
                {entry.lines.map((l, i) => l.kind === "link"
                  ? <p key={i} className="t-line t-link"><a href={l.href}>{l.text}</a></p>
                  : <p key={i} className={`t-line t-${l.kind}`}>{l.text}</p>)}
              </div>
            ))}
          </div>
          <form className="term-row" onSubmit={(e) => { e.preventDefault(); exec(value); }}>
            <label htmlFor="term-input" className="term-prompt">{PROMPT}</label>
            <input id="term-input" ref={input} className="term-input" value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey}
              autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send" aria-describedby="term-try" />
          </form>
        </div>
        <div className="term-try" id="term-try">
          <span className="suggest-label"><Icon name="terminal" /> Try:</span>
          <ul>
            {TRY.map((c) => <li key={c}><button type="button" className="suggest-q mono" onClick={() => exec(c)}>{c}</button></li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
