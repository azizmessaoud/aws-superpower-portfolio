import { PROOF } from "../../content/labels";

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
  /* the card face: one figure, one line, a few tools, a short caveat. Each is condensed from text already in the case study. */
  figure: { value: string; caption: string };
  blurb: string;
  tags: string[];
  caveatShort: string;
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
    figure: { value: "−19%", caption: "pedestrian wait at the morning peak (116.3 s vs 144.1 s), in simulation" },
    blurb: "Six junctions on the real streets of central Tunis, controlled by cooperating agents.",
    tags: ["Multi-agent", "SUMO", "TraCI"],
    caveatShort: "Ambulances were slower; no difference is significant with three seeds.",
    boundary: "Team of six; our team made the agent architecture together and roles rotate, so other pairs also touched these areas. Road demand is synthetic.",
    proof: PROOF.traffix,
  },
  {
    id: "flyrank",
    title: "FlyRank page ranking",
    kind: "Internship capstone · FlyRank AI · 2026",
    result: "Precision@50 of 0.94 (47 of 50) against 0.76 (38 of 50) for a fixed baseline, on 1,583 held-out pages from 8 unseen clients.",
    caveat: "The outcome is observational, so it does not show that editing a page increases traffic.",
    figure: { value: "0.94", caption: "Precision@50 vs 0.76 for a fixed baseline, on 1,583 held-out pages" },
    blurb: "Ranks webpages so the most useful ones reach a human reviewer first.",
    tags: ["Random Forest", "Search Console", "Unseen-client test"],
    caveatShort: "The outcome is observational: it does not show that an edit raises traffic.",
    boundary: "Built during the FlyRank AI internship; the internship warehouse is gated, so the result cannot be fully reproduced in public.",
    proof: PROOF.flyrank,
  },
  {
    id: "hr",
    title: "HR document checks",
    kind: "Prototype · synthetic documents · 2026",
    result: "A local pipeline that checks HR documents and explains every flag with a rule, severity and remediation.",
    caveat: "No accuracy on real documents is claimed: it was tested on synthetic PDFs and images only.",
    figure: { value: "7 steps", caption: "from upload check to human review, every flag explained" },
    blurb: "A local pipeline that checks HR documents and explains each flag before a person decides.",
    tags: ["Docling", "RapidOCR", "FastAPI"],
    caveatShort: "Tested on synthetic documents only; no real-data accuracy is claimed.",
    boundary: "A person decides; nothing is written to an HR system automatically.",
    proof: PROOF.hr,
  },
];
