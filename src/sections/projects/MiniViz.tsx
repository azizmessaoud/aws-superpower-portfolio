import type { CSSProperties } from "react";
import { useInView } from "../../ui/useInView";
import type { CaseSummary } from "./summary";

/* A small picture on each project card, drawn from numbers that are already in the case study. Decorative only (aria-hidden),
 * so it adds no text. It plays once when you reach it (the cells fill to 47 of 50, the junctions and steps light in order); with reduced motion or
 * without script it is drawn finished.
 *   TraffiX: six junctions (J1-J6). FlyRank: 50 squares, 47 filled = the 47 hits of 50 in the Precision@50 figure,
 *   outlined squares are misses, as in the case study. HR document checks: the seven pipeline steps. */
const SHAPE: Record<CaseSummary["id"], { n: number; on: number; kind: "dots" | "cells" }> = {
  traffix: { n: 6, on: 6, kind: "dots" },
  flyrank: { n: 50, on: 47, kind: "cells" },
  hr: { n: 7, on: 7, kind: "dots" },
};

export default function MiniViz({ id }: { id: CaseSummary["id"] }) {
  const s = SHAPE[id];
  const [ref, seen] = useInView<HTMLOListElement>(0.6);
  return (
    <ol className={`mini mini-${s.kind}`} aria-hidden="true" ref={ref} data-in={seen ? "" : undefined}>
      {Array.from({ length: s.n }, (_, i) => (
        <li key={i} className={i < s.on ? "on" : "off"} style={{ "--i": i } as CSSProperties} />
      ))}
    </ol>
  );
}
