import type { CSSProperties } from "react";
import type { CaseSummary } from "./summary";

/* A small picture on each project card, drawn from numbers that are already in the case study. Decorative only (aria-hidden),
 * so it adds no text. On hover the cells ripple; with reduced motion they stay still.
 *   TraffiX: six junctions (J1-J6). FlyRank: 50 squares, 47 filled = the 47 hits of 50 in the Precision@50 figure,
 *   outlined squares are misses, as in the case study. HR document checks: the seven pipeline steps. */
const SHAPE: Record<CaseSummary["id"], { n: number; on: number; kind: "dots" | "cells" }> = {
  traffix: { n: 6, on: 6, kind: "dots" },
  flyrank: { n: 50, on: 47, kind: "cells" },
  hr: { n: 7, on: 7, kind: "dots" },
};

export default function MiniViz({ id }: { id: CaseSummary["id"] }) {
  const s = SHAPE[id];
  return (
    <ol className={`mini mini-${s.kind}`} aria-hidden="true">
      {Array.from({ length: s.n }, (_, i) => (
        <li key={i} className={i < s.on ? "on" : "off"} style={{ "--i": i } as CSSProperties} />
      ))}
    </ol>
  );
}
