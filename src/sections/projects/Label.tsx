import { LABELS, type LabelKey } from "../../content/labels";
import Icon from "../../ui/Icon";

const ROWS = [
  ["data", "Data"],
  ["evaluation", "How it was judged"],
  ["fails", "Where it fails"],
  ["review", "Who reviews the output"],
] as const;

/* A fixed four-part label, the same on every project, so the three can be compared side by side. */
export default function Label({ project }: { project: LabelKey }) {
  const label = LABELS[project];
  return (
    <section className="plabel" aria-label="Project label">
      <dl>
        {ROWS.map(([key, title]) => (
          <div key={key} className={`plabel-row${key === "fails" ? " plabel-fails" : ""}`}>
            <dt>{key === "fails" && <Icon name="alert" />}{title}</dt>
            <dd><ul>{label[key].map((t) => <li key={t}>{t}</li>)}</ul></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
