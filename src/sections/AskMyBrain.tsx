import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ASK_EVENT } from "../ask";
import type { Corpus } from "../content/schema";
import corpusJson from "../generated/corpus.json";
import { createRetriever, type Result } from "../retrieval/retriever";
import Icon from "../ui/Icon";

const SUGGESTED = [
  "Is TraffiX deployed in Tunis?",
  "How did you avoid data leakage?",
  "What is the OCR accuracy on real documents?",
  "What did you personally build in the TraffiX team?",
];

type State = { kind: "idle" } | { kind: "results"; query: string; results: Result[] } | { kind: "none"; query: string };

export default function AskMyBrain() {
  const retriever = useMemo(() => createRetriever(corpusJson as Corpus), []);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const hintId = useId();

  function run(q: string) {
    const clean = q.trim();
    if (!clean) { input.current?.focus(); return; }
    setQuery(clean);
    const results = retriever.search(clean, 3);
    setState(results.length ? { kind: "results", query: clean, results } : { kind: "none", query: clean });
  }

  useEffect(() => {
    const on = (e: Event) => { const q = (e as CustomEvent<string>).detail; run(q); };
    window.addEventListener(ASK_EVENT, on);
    return () => window.removeEventListener(ASK_EVENT, on);
  });

  const count = state.kind === "results" ? state.results.length : 0;

  return (
    <section id="ask" className="section ask" aria-labelledby="ask-title">
      <div className="inner">
        <p className="sec-label">Creative feature</p>
        <h2 id="ask-title" className="sec-h2">Ask my brain</h2>
        <p className="sec-lead">
          Ask about my projects in your own words. It searches {corpusJson.passages.length} verified passages and shows the
          evidence behind each match, or tells you nothing verified answers it. It doesn't write answers, and it doesn't
          judge anyone.
        </p>

        <form className="ask-form" role="search" onSubmit={(e) => { e.preventDefault(); run(query); }}>
          <label htmlFor="ask-input" className="ask-label">Your question</label>
          <div className="ask-row">
            <input id="ask-input" ref={input} className="ask-input" type="search" value={query} autoComplete="off"
              placeholder="e.g. How do you process scanned documents?" aria-describedby={hintId}
              onChange={(e) => setQuery(e.target.value)} />
            <button className="btn-primary ask-submit" type="submit"><Icon name="search" /> Search</button>
          </div>
          <div className="suggest" id={hintId}>
            <span className="suggest-label">Not sure what to ask? Try:</span>
            <ul>
              {SUGGESTED.map((q) => (
                <li key={q}>
                  <button type="button" className="suggest-q" aria-pressed={state.kind !== "idle" && state.query === q}
                    onClick={() => { setQuery(q); run(q); }}>{q}</button>
                </li>
              ))}
            </ul>
          </div>
        </form>

        <p className="sr-only" role="status" aria-live="polite">
          {state.kind === "results" ? `${count} verified passage${count > 1 ? "s" : ""} found.` : state.kind === "none" ? "No verified passage answers that question." : ""}
        </p>

        {state.kind === "none" && (
          <div className="ask-none" key={state.query}>
            <h3 tabIndex={-1} ref={resultsHeading}>No verified passage answers “{state.query}”.</h3>
            <p>I only answer from evidence in my repositories. Try asking about TraffiX, the FlyRank capstone or the HR prototype.</p>
          </div>
        )}

        {state.kind === "results" && (
          <div className="ask-results" key={state.query}>
            <h3 className="ask-results-h">{count} passage{count > 1 ? "s" : ""} for “{state.query}”</h3>
            <ol>
              {state.results.map((r, i) => (
                <li key={r.passage.id} className="result" style={{ animationDelay: `${i * 60}ms` }}>
                  <p className="result-project">{r.passage.projectTitle}</p>
                  <h4 className="result-title">{r.passage.title}</h4>
                  <p className="result-text">{r.passage.text}</p>
                  <p className="result-context">{r.passage.context}</p>
                  {r.passage.limitations.length > 0 && (
                    <div className="limits limits-compact">
                      <h5><Icon name="alert" /> Limits</h5>
                      <ul>{r.passage.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
                    </div>
                  )}
                  <p className="result-why">
                    <span>Matched on</span> {r.why.matchedTerms.join(", ")}
                    <span className="result-mode"> · keyword search</span>
                  </p>
                  <ul className="evidence">
                    {r.passage.evidence.map((e) => (
                      <li key={e.url}><a href={e.url}>{e.label} <Icon name="external" /></a></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
