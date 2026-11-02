import type { CSSProperties } from "react";
import { useInView } from "../../ui/useInView";
import type { Compare } from "./summary";

/* Two bars on a true zero baseline: the baseline first, then the result, so the gap is the finding. Bars grow once, when the card is reached,
 * and are drawn at full length with reduced motion or without script. Values are the ones in the caption and the case study. */
export default function CompareBars({ c }: { c: Compare }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  const max = Math.max(...c.rows.map((r) => r.value));
  const spoken = `${c.what}: ${c.rows.map((r) => `${r.label} ${r.value}${c.unit}`).join(", ")}. ${c.better === "lower" ? "Lower" : "Higher"} is better.`;
  return (
    <div className="cmp" ref={ref} data-in={seen ? "" : undefined} role="img" aria-label={spoken}>
      {c.rows.map((r, i) => (
        <div key={r.label} className={`cmp-row${r.ours ? " is-ours" : ""}`} style={{ "--w": `${((r.value / max) * 100).toFixed(1)}%`, "--n": i } as CSSProperties} aria-hidden="true">
          <span className="cmp-label">{r.label}</span>
          <span className="cmp-track"><i /></span>
          <span className="cmp-val">{r.value}{c.unit}</span>
        </div>
      ))}
    </div>
  );
}
