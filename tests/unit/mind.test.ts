import { describe, expect, it } from "vitest";
import { nextState, stateForOutcome, STATE_TEXT, type MindState } from "../../src/mind/state";

describe("mind state follows the question lifecycle", () => {
  it("idle → listening → retrieving → answering → idle", () => {
    let s: MindState = "idle";
    s = nextState(s, { type: "focus" }); expect(s).toBe("listening");
    s = nextState(s, { type: "submit" }); expect(s).toBe("retrieving");
    s = nextState(s, { type: "result", outcome: "supported" }); expect(s).toBe("answering");
    s = nextState(s, { type: "settle" }); expect(s).toBe("idle");
  });
  it("missing evidence is uncertain; a contradicting answer is still an answer; failures are errors", () => {
    expect(stateForOutcome("not_verified")).toBe("uncertain");
    expect(stateForOutcome("contradicted")).toBe("answering");
    expect(stateForOutcome("error")).toBe("error");
    expect(stateForOutcome("out_of_scope")).toBe("uncertain");
    expect(stateForOutcome("related")).toBe("answering");
    expect(stateForOutcome("info")).toBe("answering");
  });
  it("typing or blurring cannot interrupt retrieving", () => {
    expect(nextState("retrieving", { type: "type", empty: false })).toBe("retrieving");
    expect(nextState("retrieving", { type: "blur" })).toBe("retrieving");
  });
  it("a result only lands while retrieving, so a late result cannot reopen an old state", () => {
    expect(nextState("idle", { type: "result", outcome: "supported" })).toBe("idle");
  });
  it("every state has plain text, and none of it claims confidence or private thoughts", () => {
    for (const t of Object.values(STATE_TEXT)) expect(t).not.toMatch(/confiden|thinking|certain(?!ly)|%/i);
  });
});
