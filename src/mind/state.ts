/* The mind's state mirrors the question lifecycle in the interface. It says what the page is doing,
 * never what a model "thinks", and carries no confidence value. */
export type MindState = "idle" | "listening" | "retrieving" | "answering" | "uncertain" | "error";
export type Outcome = "supported" | "contradicted" | "not_verified" | "error";

/** How long each transient state stays visible, so a fast local lookup is still readable. */
export const DWELL_MS: Record<MindState, number> = { idle: 0, listening: 0, retrieving: 700, answering: 2400, uncertain: 3200, error: 2400 };

/** Text for the status line: the primary signal, with or without animation. */
export const STATE_TEXT: Record<MindState, string> = {
  idle: "Idle. Ask a question.",
  listening: "Listening",
  retrieving: "Retrieving evidence",
  answering: "Answering from evidence",
  uncertain: "Not verified: no evidence either way",
  error: "Could not process that question",
};

/** The state that follows a finished lookup. A contradicted answer is still an answer: the evidence spoke. */
export function stateForOutcome(o: Outcome): MindState {
  return o === "not_verified" ? "uncertain" : o === "error" ? "error" : "answering";
}

/** Events the interface can raise. */
export type MindEvent =
  | { type: "focus" } | { type: "type"; empty: boolean } | { type: "blur" }
  | { type: "submit" } | { type: "result"; outcome: Outcome } | { type: "settle" };

/** Pure transition table. `settle` fires after a transient state's dwell time. */
export function nextState(s: MindState, e: MindEvent): MindState {
  switch (e.type) {
    case "focus": return s === "idle" ? "listening" : s;
    case "type": return s === "retrieving" ? s : e.empty ? "idle" : "listening";
    case "blur": return s === "listening" ? "idle" : s;
    case "submit": return "retrieving";
    case "result": return s === "retrieving" ? stateForOutcome(e.outcome) : s;
    case "settle": return s === "answering" || s === "uncertain" || s === "error" ? "idle" : s;
  }
}
