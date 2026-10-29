import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ASK_EVENT } from "../ask";
import type { Corpus } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import { createTerminal, type Line } from "../terminal/commands";
import Icon from "../ui/Icon";

const PROMPT = "visitor@ask-my-brain:~$";
const TRY = [
  "help",
  "projects",
  "ask What did you personally build in the TraffiX team?",
  "ask Is TraffiX deployed in Tunis?",
  "ask How did you avoid data leakage?",
  "ask What is the OCR accuracy on real documents?",
];
type Entry = { id: number; cmd?: string; lines: Line[] };

/* The Terminal Explorer is "Ask my brain": questions and commands over the same verified passages.
 * Tab is never captured (no keyboard trap); ↑/↓ recall history; output is a polite live log. */
export default function Terminal() {
  const term = useMemo(() => createTerminal(corpusJson as Corpus), []);
  const [log, setLog] = useState<Entry[]>([{ id: 0, lines: [{ kind: "muted", text: "Type help to see the commands, or try one below." }] }]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  function exec(cmd: string) {
    const out = term.run(cmd);
    if (out === "clear") setLog([]);
    else setLog((l) => [...l.slice(-30), { id: nextId.current++, cmd, lines: out }]);
    if (cmd.trim()) setHistory((h) => [cmd, ...h].slice(0, 30));
    setHIdx(-1);
    setValue("");
    requestAnimationFrame(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; });
  }
  useEffect(() => {
    const on = (e: Event) => exec(`ask ${(e as CustomEvent<string>).detail}`);
    window.addEventListener(ASK_EVENT, on);
    return () => window.removeEventListener(ASK_EVENT, on);
  });
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp" && history.length) { e.preventDefault(); const i = Math.min(hIdx + 1, history.length - 1); setHIdx(i); setValue(history[i]); }
    else if (e.key === "ArrowDown" && hIdx >= 0) { e.preventDefault(); const i = hIdx - 1; setHIdx(i); setValue(i >= 0 ? history[i] : ""); }
  }

  return (
    <section id="terminal" className="section terminal-section" aria-labelledby="terminal-title">
      <div className="inner">
        <p className="sec-label">Creative feature</p>
        <h2 id="terminal-title" className="sec-h2">Ask my brain: the Terminal Explorer</h2>
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
