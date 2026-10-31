/* One summary per flagship project, used by the "Selected work" strip near the hero and by the top of each case study,
 * so the two cannot disagree. Every line repeats a statement already on the project card (TR-*, FR-*, HR-* rows).
 * `myPart` is present only where the evidence records Aziz's own part; do not add one without a source. */
export interface CaseSummary {
  id: "traffix" | "flyrank" | "hr";
  title: string;
  kind: string;
  result: string;
  caveat: string;
  myPart?: string;
  boundary: string;
  proof: { label: string; url: string };
}

export const CASES: CaseSummary[] = [
  {
    id: "traffix",
    title: "TraffiX",
    kind: "Team simulation · ESPRIT course project · 2026",
    result: "Pedestrian wait fell 19% at the morning peak against SUMO's actuated signals (116.3 s vs 144.1 s), in simulation.",
    caveat: "Ambulance trips were slower in the emergency scenario, and no difference is significant with three seeds.",
    myPart: "The Control pair with Fares Ben Kacem: SUMO, observations, the A1 agent, safety and the controllers.",
    boundary: "Team of six; our team made the agent architecture together and roles rotate, so other pairs also touched these areas. Road demand is synthetic.",
    proof: { label: "README @ d54b071", url: "https://github.com/azizmessaoud/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a/README.md#L1-L11" },
  },
  {
    id: "flyrank",
    title: "FlyRank page ranking",
    kind: "Internship capstone · FlyRank AI · 2026",
    result: "Precision@50 of 0.94 (47 of 50) against 0.76 (38 of 50) for a fixed baseline, on 1,583 held-out pages from 8 unseen clients.",
    caveat: "The outcome is observational, so it does not show that editing a page increases traffic.",
    boundary: "Built during the FlyRank AI internship; the internship warehouse is gated, so the result cannot be fully reproduced in public.",
    proof: { label: "Capstone report @ a220b9e", url: "https://github.com/azizmessaoud/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204/work/capstone_report.md#L55" },
  },
  {
    id: "hr",
    title: "HR document checks",
    kind: "Prototype · synthetic documents · 2026",
    result: "A local pipeline that checks HR documents and explains every flag with a rule, severity and remediation.",
    caveat: "No accuracy on real documents is claimed: it was tested on synthetic PDFs and images only.",
    boundary: "A person decides; nothing is written to an HR system automatically.",
    proof: { label: "README @ 437a514", url: "https://github.com/azizmessaoud/hr-anomaly-detection/blob/437a5142df8bed783a5b30ee6f02710a05c45a52/README.md#L1-L16" },
  },
];
