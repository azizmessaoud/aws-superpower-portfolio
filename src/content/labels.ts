/* The "label" on each project: where the data came from, how it was judged, where it fails, who reviews the output.
 * Every line restates something already shown and sourced in the project's case study; add nothing here that the
 * case study does not support. The same text feeds the page and the terminal's `label` command. */
export const LABEL_KEYS = ["traffix", "flyrank", "hr"] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];
export interface ProjectLabel { data: string[]; evaluation: string[]; fails: string[]; review: string[] }

export const LABELS: Record<LabelKey, ProjectLabel> = {
  traffix: {
    data: ["Road demand is synthetic, on a map of six real junctions in central Tunis.", "18 of 21 junction roads use unverified lane counts."],
    evaluation: ["Trained models against SUMO actuated signals: 3 scenarios, 3 seeds, 20 Oct 2026.", "No difference is significant at p < 0.05."],
    fails: [
      "Simulation only, with synthetic road demand.",
      "Three seeds and three scenarios; no result is statistically significant yet.",
      "18 of 21 junction roads use unverified lane counts.",
      "The slower ambulance trips are not explained yet.",
    ],
    review: ["Every change of a light carries a reason code in a decision log.", "Synapse explains from that log and never acts on the simulation."],
  },
  flyrank: {
    data: ["Signals from 31 March 2026; the outcome is Search Console clicks from 1–7 April.", "11,802 training rows from 21 clients; 1,583 test rows from 8 other clients."],
    evaluation: [
      "A baseline was fixed before the label was used.",
      "Whole clients were held out, and a deliberately leaked feature was caught and removed.",
      "Precision@50 0.94 against 0.76; R² 0.50 against 0.26.",
    ],
    fails: [
      "One decision date and one outcome week.",
      "Observational, not causal: it does not show that editing a page increases traffic.",
      "The internship warehouse is gated, so the result cannot be fully reproduced in public.",
    ],
    review: ["The output is a ranking for an editor to look at first, not an automatic action."],
  },
  hr: {
    data: ["Synthetic PDFs and images only."],
    evaluation: ["Deterministic local tests.", "No accuracy figure is claimed."],
    fails: [
      "OCR accuracy on real documents has not been measured; tests use synthetic PDFs and images.",
      "Celery, Redis and PostgreSQL appear only in the planned full-stack mode; they are not built.",
      "CSV and Excel files are outside the current OCR contract.",
    ],
    review: [
      "Every flag carries a rule, severity, explanation and remediation, with sensitive values masked.",
      "A person decides; nothing is written to the HR system automatically.",
    ],
  },
};

/* The one source each project's label restates: the card's "proof" link. Kept next to the label so an answer built from the label cites it. */
export const PROOF: Record<LabelKey, { label: string; url: string }> = {
  traffix: { label: "README @ d54b071", url: "https://github.com/azizmessaoud/traffix/blob/d54b0710854c13966e8eca652d6e01513a47059a/README.md#L1-L11" },
  flyrank: { label: "Capstone report @ a220b9e", url: "https://github.com/azizmessaoud/flyrank/blob/a220b9ef1d20e5bb042562346f4c8ba84b8ca204/work/capstone_report.md#L55" },
  hr: { label: "README @ 437a514", url: "https://github.com/azizmessaoud/hr-anomaly-detection/blob/437a5142df8bed783a5b30ee6f02710a05c45a52/README.md#L1-L16" },
};
export const PROJECT_NAME: Record<LabelKey, string> = { traffix: "TraffiX", flyrank: "FlyRank", hr: "HR prototype" };
