import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Corpus, Portfolio } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import portfolioJson from "../generated/portfolio.json";
import { createAssistant, MAX_QUESTION } from "../assistant/answer";
import { presentAnswer, projectIdOf } from "../assistant/present";
import { stateForOutcome, type MindState } from "../mind/state";
import Icon from "../ui/Icon";

const QUESTIONS = [
  "What role is Aziz looking for?",
  "What did he build in TraffiX?",
  "How did he evaluate FlyRank?",
];
const ASK_API_URL = import.meta.env.VITE_ASK_API_URL?.trim();

type EvidenceLink = { label: string; url: string };
type Turn = {
  id: number;
  role: "visitor" | "guide";
  text: string;
  evidence?: EvidenceLink[];
  limitations?: string[];
};
type ApiReply = {
  answer?: string;
  error?: string;
  citations?: Array<{ sourceId?: string; excerpt?: string }>;
};

interface Props { mind: MindState; setMind: (s: MindState) => void; reduced: boolean }

const STATUS: Record<MindState, string> = {
  idle: "Ready when you are.",
  listening: "Your question is ready.",
  retrieving: "Checking the project notes…",
  answering: "Answer ready. You can open the cited sources below.",
  uncertain: "I couldn’t verify that from the published notes.",
  error: "I couldn’t complete that search. Try again in a moment.",
};

function uniqueLinks(links: EvidenceLink[]) {
  return [...new Map(links.map((link) => [link.url, link])).values()];
}

export default function AskPanel({ mind, setMind, reduced }: Props) {
  const assistant = useMemo(() => createAssistant(corpusJson as Corpus, portfolioJson as Portfolio), []);
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(0);
  const transcript = useRef<HTMLOListElement>(null);
  const aborter = useRef<AbortController | null>(null);
  const busy = mind === "retrieving";

  useEffect(() => () => aborter.current?.abort(), []);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTo({ top: transcript.current.scrollHeight, behavior: reduced ? "instant" : "smooth" });
  }, [turns, busy, reduced]);

  function addGuideTurn(turn: Omit<Turn, "id" | "role">) {
    setTurns((current) => [...current, { ...turn, id: nextId.current++, role: "guide" }]);
  }

  function reset() {
    aborter.current?.abort();
    aborter.current = null;
    setTurns([]);
    nextId.current = 0;
    setValue("");
    setMind("idle");
  }

  async function submit(raw: string) {
    const question = raw.trim();
    if (!question || busy) return;
    setValue("");
    setTurns((current) => [...current, { id: nextId.current++, role: "visitor", text: question }]);
    setMind("retrieving");

    if (ASK_API_URL) {
      const controller = new AbortController();
      aborter.current = controller;
      let timedOut = false;
      const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 27_000);
      try {
        const response = await fetch(ASK_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
        const data = await response.json() as ApiReply;
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error.slice(0, 180) : "The portfolio guide is temporarily unavailable.");
        const passages = (data.citations ?? [])
          .map((citation) => corpusJson.passages.find((passage) => passage.id === citation.sourceId))
          .filter((passage): passage is (typeof corpusJson.passages)[number] => !!passage);
        const evidence = uniqueLinks(passages.flatMap((passage) => passage.evidence));
        const limitations = [...new Set(passages.flatMap((passage) => passage.limitations))];
        if (!evidence.length) {
          addGuideTurn({ text: "I couldn’t verify that from the published portfolio notes. Try asking about a project, a role, or a tool—or contact Aziz directly." });
          setMind("uncertain");
        } else {
          addGuideTurn({
            text: typeof data.answer === "string" && data.answer.trim() ? data.answer.trim() : "Here are the checked notes that relate to your question.",
            evidence,
            limitations,
          });
          setMind("answering");
        }
      } catch (error) {
        if (controller.signal.aborted && !timedOut) return;
        const message = error instanceof Error && error.message.length <= 180
          ? error.message
          : "I couldn’t reach the hosted portfolio guide. Please try again, or contact Aziz directly.";
        addGuideTurn({ text: message });
        setMind("error");
      } finally {
        clearTimeout(timeout);
        aborter.current = null;
      }
      return;
    }

    /* The public site stays useful before the AWS endpoint is connected: this local path searches the same checked passages. */
    if (!reduced) await new Promise((resolve) => window.setTimeout(resolve, 240));
    const answer = assistant.ask(question);
    const view = presentAnswer(answer, projectIdOf(answer));
    const text = answer.outcome === "not_verified"
      ? "I couldn’t verify that from the published portfolio notes. Try asking about a project, a role, or a tool—or contact Aziz directly."
      : answer.outcome === "error"
        ? answer.answer
        : [view.headline, view.detail, ...(view.points ?? [])].filter(Boolean).join(" ");
    addGuideTurn({
      text,
      evidence: uniqueLinks(answer.evidence),
      limitations: answer.limitations,
    });
    setMind(stateForOutcome(answer.outcome));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(value);
  }

  return (
    <section className="ask" id="ask" aria-labelledby="ask-title">
      <div className="ask-heading">
        <div>
          <h2 id="ask-title">Questions about my work?</h2>
          <p>Ask about my projects, experience or what I could bring to a team. Replies link to the notes behind them.</p>
        </div>
        {turns.length > 0 && <button className="ask-reset" type="button" onClick={reset} disabled={busy}>New conversation</button>}
      </div>

      {turns.length > 0 && (
        <ol className="ask-transcript" ref={transcript} role="log" aria-live="polite" aria-label="Conversation">
          {turns.map((turn) => (
            <li key={turn.id} className={`ask-turn is-${turn.role}`}>
              <p className="ask-turn-label">{turn.role === "visitor" ? "You" : "Portfolio guide"}</p>
              <p className="ask-turn-text">{turn.text}</p>
              {turn.evidence && turn.evidence.length > 0 && (
                <div className="ask-turn-sources">
                  <p>Sources</p>
                  <ul>{turn.evidence.map((link) => <li key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}<Icon name="external" /></a></li>)}</ul>
                </div>
              )}
              {turn.limitations && turn.limitations.length > 0 && (
                <details className="ask-turn-limits">
                  <summary>Read the project limits</summary>
                  <ul>{turn.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
                </details>
              )}
            </li>
          ))}
          {busy && <li className="ask-turn is-guide is-pending"><p className="ask-turn-label">Portfolio guide</p><p className="ask-turn-text">Checking the notes and preparing a reply…</p></li>}
        </ol>
      )}

      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="hero-ask" className="sr-only">Ask about Aziz’s work</label>
        <div className="ask-row">
          <input id="hero-ask" className="ask-input" type="text" value={value} maxLength={MAX_QUESTION} autoComplete="off"
            placeholder="e.g. What could I contribute to your team?"
            onChange={(event) => { setValue(event.target.value); setMind(event.target.value ? "listening" : "idle"); }}
            onFocus={() => { if (!value && mind === "idle") setMind("listening"); }}
            onBlur={() => { if (!value && mind === "listening") setMind("idle"); }}
            disabled={busy} enterKeyHint="send" />
          <button className="btn-primary ask-submit" type="submit" aria-label="Send question" disabled={busy || !value.trim()} aria-busy={busy}>
            <span>{busy ? "Checking" : "Ask"}</span><Icon name="arrow" />
          </button>
        </div>
      </form>

      <p className="ask-status" role="status" aria-live="polite"><span className="ask-dot" aria-hidden="true" />{busy ? "Checking the project notes…" : STATUS[mind]}</p>
      {turns.length === 0 && (
        <ul className="ask-samples" aria-label="Suggested questions">
          {QUESTIONS.map((question) => <li key={question}><button type="button" className="suggest-q" onClick={() => { setValue(question); void submit(question); }}>{question}</button></li>)}
        </ul>
      )}
      <p className="ask-how">Every answer is grounded in checked portfolio notes. If a detail isn’t supported, the guide says so.</p>
    </section>
  );
}
