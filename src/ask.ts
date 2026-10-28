/* Lets any "try this question" button hand a question to Ask my brain. */
export const ASK_EVENT = "ask-my-brain";
export function askQuestion(q: string) {
  window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: q }));
  const el = document.getElementById("ask");
  el?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
