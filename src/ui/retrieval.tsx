/* The two states main's answer card does not cover: a lookup that is still running, and a lookup that failed.
 * Both are kept visibly apart from "Not verified": a technical failure says nothing about the evidence. */
import type { Ref } from "react";
import type { RetrievalFailure } from "../retrieval/contracts";
import ActionButton, { type ActionState } from "./ActionButton";

const CAUSE_LABEL: Record<RetrievalFailure["cause"], string> = {
  exception: "Lookup error: not about the evidence",
  malformed: "Lookup returned unusable data: not about the evidence",
  timeout: "Lookup timed out: not about the evidence",
};
const CAUSE_NOTE: Record<RetrievalFailure["cause"], string> = {
  exception: "Retrying usually works.",
  malformed: "Retrying may help. If it keeps happening, the lookup itself needs fixing.",
  timeout: "Retrying usually works.",
};

interface ErrorProps {
  failure: RetrievalFailure;
  retryState: ActionState;
  slow: boolean;
  onRetry: () => void;
  onCancel: () => void;
  sectionRef?: Ref<HTMLElement>;
}

/** What happened, that the question is kept, and how to retry. */
export function RetrievalErrorCard({ failure, retryState, slow, onRetry, onCancel, sectionRef }: ErrorProps) {
  const retrying = retryState === "loading";
  return (
    <section ref={sectionRef} className="ask-answer is-error" aria-label="Retrieval error" tabIndex={-1} aria-busy={retrying || undefined}>
      <p className="ask-outcome">{CAUSE_LABEL[failure.cause]}</p>
      <h2 className="ask-title">Could not look that up</h2>
      <p className="ask-text">{failure.message}</p>
      <p className="ask-text">Your question is kept: <q className="ask-kept">{failure.query}</q></p>
      <div className="ask-actions">
        <ActionButton variant="ghost" icon="retry" state={retryState} label="Retry this question"
          labels={{ loading: "Retrying", error: "Failed again, retry" }} onClick={onRetry} />
        {retrying && slow && <ActionButton variant="ghost" label="Cancel" onClick={onCancel} />}
      </div>
      <p className="ask-note">{CAUSE_NOTE[failure.cause]} This is a technical problem, not a statement about the evidence.</p>
      <details className="ask-detail">
        <summary>Technical detail</summary>
        <code>{failure.detail}</code>
      </details>
    </section>
  );
}

/** Placeholder while retrieving, laid out like the answer it stands in for. After a slow wait it offers Cancel. */
export function ResultSkeleton({ slow, onCancel }: { slow: boolean; onCancel: () => void }) {
  return (
    <div className="ask-skeleton" data-slow={slow || undefined}>
      {slow && (
        <div className="ask-slow">
          <p className="ask-note">Press Esc or Cancel to stop. Your question stays in the box.</p>
          <ActionButton variant="ghost" label="Cancel" onClick={onCancel} />
        </div>
      )}
      <div className="sk-bars" aria-hidden="true">
        <span className="sk sk-outcome" /><span className="sk sk-title" />
        <span className="sk sk-line" /><span className="sk sk-line" /><span className="sk sk-line sk-short" />
      </div>
    </div>
  );
}
