/* Lets any "try this question" button hand a question to the Terminal Explorer. */
export const ASK_EVENT = "ask-my-brain";
export function askQuestion(q: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: q }));
  const el = document.getElementById("terminal");
  el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
