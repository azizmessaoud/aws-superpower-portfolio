import { describe, expect, it } from "vitest";
import { buildEdges, cameraZoom, placeSphere, seedBrain, seedShell, ZOOM_DEEP, ZOOM_OPEN } from "../../src/scene/geometry";

describe("scene geometry", () => {
  it("seeds the same brain every time", () => {
    expect(Array.from(seedBrain(200))).toEqual(Array.from(seedBrain(200)));
    expect(seedBrain(400).length).toBe(1200);
  });
  it("puts every label on the sphere exactly once", () => {
    const labels = ["Python", "SQL", "R", "FastAPI"];
    const nodes = seedShell(34, labels);
    expect(nodes.filter((n) => n.label).map((n) => n.label).sort()).toEqual([...labels].sort());
  });
  it("links nodes without duplicates or self-loops", () => {
    const edges = buildEdges(seedShell(48, []), 3);
    const keys = edges.map((e) => `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(edges.every((e) => e.from !== e.to)).toBe(true);
  });
  it("zooms from close-up to the sphere on open, then into the brain on scroll", () => {
    expect(cameraZoom(0, 0)).toBeCloseTo(ZOOM_OPEN);
    expect(cameraZoom(1, 0)).toBeCloseTo(1);
    expect(cameraZoom(1, 1)).toBeCloseTo(ZOOM_DEEP);
  });
  it("keeps the sphere clear of the text box", () => {
    const text = { l: 60, t: 200, r: 760, b: 640 };
    const s = placeSphere(1280, 860, text, true);
    expect(s.cx - s.R).toBeGreaterThan(text.r);
    const m = placeSphere(390, 860, { l: 0, t: 80, r: 390, b: 520 }, false);
    expect(m.cy - m.R).toBeGreaterThan(520);
  });
});
