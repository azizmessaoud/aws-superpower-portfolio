/* The sample questions under the Ask bar. They are the first thing a visitor tries, so each one is chosen to show something the site is for,
 * and each must be answered well by the engine (tests/unit/samples.test.ts). Order matters: phones show the first three.
 *   1. who did what: an honest account of my part in a team project
 *   2. honest limits: where a result stops
 *   3. rigour: a result that did not hold up on data the team had not tuned on
 *   4. the AWS record, as it stands
 *   5. what a recruiter can ask next
 *   6. an honest "no": a tool the evidence never mentions, so the site abstains and says which word it found nothing for
 * No sample depends on a TraffiX result (those are being re-sourced), so none can contradict the project's published figures. */
export const SAMPLES = [
  "What did Aziz personally build in TraffiX?",
  "Where does FlyRank fail?",
  "Did the RAG gain hold up on held-out questions?",
  "What is the AWS hosting status?",
  "What should I ask Aziz in an interview?",
  "Does Aziz know Kubernetes?",
] as const;
/** the one sample that is meant to be refused */
export const SAMPLE_ABSTAINS = "Does Aziz know Kubernetes?";
