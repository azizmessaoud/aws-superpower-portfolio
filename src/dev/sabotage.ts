/* Test-only fault injection for the question box (FE-08: "test by sabotage").
 *
 * Never reachable by a public visitor: AskPanel only imports this behind
 *   import.meta.env.DEV || import.meta.env.MODE === "e2e"
 * which is a build-time constant, so `npm run build` (mode "production") removes it entirely.
 * `npm run dev` and the Playwright build (`npm run build:e2e`) accept  /?sabotage=<fault>  in the URL:
 *
 *   throw      the lookup throws
 *   malformed  the lookup returns data that breaks the contract
 *   nosource   the lookup returns a factual answer with its sources stripped
 *   slow       the lookup answers correctly after 2.5 s (shows the "still working" notice)
 *   hang       the lookup never answers (ends as a timeout; add &timeout=<ms> to shorten the wait)
 *   flaky      the first lookup throws, every later one works (the retry path)
 */
import type { Engine } from "../retrieval/session";

export type Fault = "throw" | "malformed" | "nosource" | "slow" | "hang" | "flaky";
const FAULTS: readonly Fault[] = ["throw", "malformed", "nosource", "slow", "hang", "flaky"];

export function faultFromUrl(search: string = location.search): { fault: Fault; timeoutMs?: number } | null {
  const params = new URLSearchParams(search);
  const fault = params.get("sabotage") as Fault | null;
  if (!fault || !FAULTS.includes(fault)) return null;
  const t = Number(params.get("timeout"));
  return { fault, timeoutMs: Number.isFinite(t) && t >= 200 ? t : undefined };
}

export function withFault(engine: Engine, fault: Fault): Engine {
  let calls = 0;
  return (q) => {
    calls += 1;
    (globalThis as { __lookups?: number }).__lookups = calls;   /* lets a test count lookups to prove retry does not duplicate them */
    switch (fault) {
      case "throw": throw new Error("injected retrieval failure");
      case "malformed": return { outcome: "supported", title: 12 };
      case "nosource": return { ...(engine(q) as object), outcome: "supported", evidence: [] };
      case "slow": return new Promise((resolve) => setTimeout(() => resolve(engine(q)), 2500));
      case "hang": return new Promise(() => {});
      case "flaky": if (calls === 1) throw new Error("injected first-call failure"); return engine(q);
    }
  };
}
