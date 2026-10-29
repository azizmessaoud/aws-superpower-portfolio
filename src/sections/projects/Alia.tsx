import { Evidence } from "./Evidence";
import Label from "./Label";

const SOURCE = "https://github.com/azizmessaoud/projectx0/blob/bd6e84df36f1cf3acb093c5a0f77544012fbc104/client/src/lib/portfolioData.ts";

/* AL-01, AL-02, AL-03. My own account, copied from my earlier portfolio's case card. The code is under NDA, so there
 * is no public repository: the evidence link is that card's source file, and the case says so. No score is shown. */
const FLOW: { step: string; detail: string; who: "Team" | "Mine" }[] = [
  { step: "Trainee in the browser", detail: "practice conversation", who: "Team" },
  { step: "Real-time session", detail: "WebSockets between browser and backend", who: "Team" },
  { step: "Conversation replies", detail: "a Groq-hosted language model", who: "Team" },
  { step: "Avatar fallback", detail: "TalkingHead.js and Three.js, for browsers that cannot use the preferred rendering path", who: "Mine" },
  { step: "Debrief deck", detail: "an agent builds a PowerPoint after the session", who: "Mine" },
];

export default function Alia() {
  return (
    <article className="case case-alia" aria-labelledby="alia-title">
      <header className="case-head">
        <p className="case-kind">Team prototype · built for Vital Laboratories Tunisia · under NDA</p>
        <h3 id="alia-title" className="case-title">ALIA</h3>
        <p className="case-framing">
          Sales representatives need realistic practice conversations and structured feedback. ALIA is a conversational avatar
          that plays the customer and, afterwards, produces a debrief. It was never tested with real trainers, and the code
          is under NDA, so nothing here can be inspected or re-run.
        </p>
        <p className="case-role"><strong>My part:</strong> the browser avatar fallback and the agent that turns a session into a PowerPoint debrief. The practice conversation, the real-time session and the conversation replies were the team's.</p>
      </header>
      <ol className="pipeline" aria-label="How a session runs">
        {FLOW.map((s, i) => (
          <li key={s.step}>
            <span className="pipe-n" aria-hidden="true">{i + 1} · {s.who}</span>
            <span className="pipe-step">{s.step}</span>
            <span className="pipe-detail">{s.detail}</span>
          </li>
        ))}
      </ol>
      <p className="results-note">Speech components are not described: the public materials do not document them.</p>
      <Label project="alia" />
      <Evidence links={[{ label: "My earlier portfolio's ALIA card (source file)", url: SOURCE }]} />
    </article>
  );
}
