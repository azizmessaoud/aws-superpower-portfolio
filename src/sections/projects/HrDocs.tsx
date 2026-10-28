import { Evidence, Limits } from "./Evidence";

const RD = "https://github.com/azizmessaoud/hr-anomaly-detection/blob/437a5142df8bed783a5b30ee6f02710a05c45a52/README.md";
const LIVE = "https://github.com/azizmessaoud/projectx0/blob/bd6e84df36f1cf3acb093c5a0f77544012fbc104/client/src/lib/portfolioData.ts#L196-L204";

/* HR-01, HR-04 (limitation), HR-05, HR-06. Prototype on synthetic documents; no accuracy figure. */
const STEPS: { step: string; detail: string; outcome?: string }[] = [
  { step: "Pre-flight", detail: "upload checks before any extraction", outcome: "Rejected input stops here" },
  { step: "Docling", detail: "native text extraction" },
  { step: "RapidOCR", detail: "fallback when confidence is low", outcome: "Unusable fallback keeps the Docling result for review" },
  { step: "Validation", detail: "schema and business rules" },
  { step: "Anomaly detection", detail: "deterministic and cohort statistics" },
  { step: "Explained flag", detail: "rule, severity, explanation, remediation; sensitive values masked" },
  { step: "Human review", detail: "a person decides; nothing is written to the HR system automatically" },
];

export default function HrDocs() {
  return (
    <article className="case case-hr" aria-labelledby="hr-title">
      <header className="case-head">
        <p className="case-kind">Prototype · synthetic documents · 2026</p>
        <h3 id="hr-title" className="case-title">HR document checks</h3>
        <p className="case-framing">
          A local, self-hosted pipeline that checks HR documents and explains every flag before a person decides whether the
          record can enter an HR information system. Today it runs as a synchronous FastAPI demo with in-memory jobs.
        </p>
      </header>
      <ol className="pipeline" aria-label="Pipeline steps">
        {STEPS.map((s, i) => (
          <li key={s.step}>
            <span className="pipe-n" aria-hidden="true">{i + 1}</span>
            <span className="pipe-step">{s.step}</span>
            <span className="pipe-detail">{s.detail}</span>
            {s.outcome && <span className="pipe-outcome">{s.outcome}</span>}
          </li>
        ))}
      </ol>
      <Limits items={[
        "OCR accuracy on real documents has not been measured; tests use synthetic PDFs and images.",
        "Celery, Redis and PostgreSQL appear only in the planned full-stack mode; they are not built.",
        "CSV and Excel files are outside the current OCR contract.",
      ]} />
      <Evidence links={[{ label: "README @ 437a514", url: `${RD}#L1-L16` }, { label: "Live portfolio HR card source", url: LIVE }]} />
    </article>
  );
}
