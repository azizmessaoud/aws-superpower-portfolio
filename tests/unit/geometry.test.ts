import { describe, expect, it } from "vitest";
import { buildEdges, cameraZoom, placeSphere, seedBrain, seedShell, DOCK_AT, FLIGHT_FROM, flightTarget, followFlight, ZOOM_DEEP, ZOOM_OPEN } from "../../src/scene/geometry";

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
  describe("the flight to the nav follows the scroll", () => {
    it("is in the hero before it starts, landed after it ends, and exact at both", () => {
      expect(flightTarget(0)).toBe(0);
      expect(flightTarget(FLIGHT_FROM)).toBe(0);
      expect(flightTarget(DOCK_AT)).toBe(1);
      expect(flightTarget(1)).toBe(1);
    });
    it("travels over most of the pinned scroll, not in a sliver at the end (it used to move within 8% of it)", () => {
      expect(DOCK_AT - FLIGHT_FROM).toBeGreaterThan(0.55);
    });
    it("is a pure function of the scroll position, so going back retraces the same path exactly", () => {
      const at = (i: number) => i / 40;                                   /* scroll positions 0, 0.025, ... 1 */
      const down = Array.from({ length: 41 }, (_, i) => flightTarget(at(i)));
      const back: number[] = []; for (let i = 40; i >= 0; i--) back[i] = flightTarget(at(i));   /* visited in the opposite order */
      down.forEach((v, i) => expect(back[i]).toBeCloseTo(v, 12));
    });
    it("only ever moves forward as you scroll forward (no stalls, no reversals), and eases in and out", () => {
      let prev = -1, slope0 = 0, slope1 = 0;
      for (let i = 0; i <= 200; i++) { const v = flightTarget(i / 200); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
      slope0 = flightTarget(FLIGHT_FROM + 0.01) - flightTarget(FLIGHT_FROM);
      slope1 = flightTarget(DOCK_AT) - flightTarget(DOCK_AT - 0.01);
      const mid = flightTarget((FLIGHT_FROM + DOCK_AT) / 2 + 0.005) - flightTarget((FLIGHT_FROM + DOCK_AT) / 2 - 0.005);
      expect(slope0).toBeLessThan(mid / 3);    /* gentle start */
      expect(slope1).toBeLessThan(mid / 3);    /* gentle landing */
    });
    it("is proportional: scrolling twice as far moves it about twice as far in the middle of the path", () => {
      const m = (FLIGHT_FROM + DOCK_AT) / 2, d = 0.01;
      expect((flightTarget(m + 2 * d) - flightTarget(m)) / (flightTarget(m + d) - flightTarget(m))).toBeGreaterThan(1.8);
    });
  });
  describe("the spring that gives it weight", () => {
    it("closes in on the target without overshooting, and lands exactly", () => {
      let v = 0; for (let i = 0; i < 200; i++) { v = followFlight(v, 1, 1 / 60); expect(v).toBeLessThanOrEqual(1); }
      expect(v).toBe(1);
      let w = 1; for (let i = 0; i < 200; i++) { w = followFlight(w, 0, 1 / 60); expect(w).toBeGreaterThanOrEqual(0); }
      expect(w).toBe(0);
    });
    it("depends on time, not on frame count: one 100 ms step equals ten 10 ms steps", () => {
      let a = followFlight(0, 1, 0.1), b = 0; for (let i = 0; i < 10; i++) b = followFlight(b, 1, 0.01);
      expect(a).toBeCloseTo(b, 6);
    });
    it("is mostly there within a third of a second, so the brain keeps up with the scroll", () => {
      expect(followFlight(0, 1, 0.33)).toBeGreaterThan(0.95);
    });
    it("a stalled clock moves nothing, and a negative step is ignored", () => {
      expect(followFlight(0.3, 1, 0)).toBe(0.3);
      expect(followFlight(0.3, 1, -1)).toBe(0.3);
    });
  });
  it("keeps the sphere clear of the text box", () => {
    const text = { l: 60, t: 200, r: 760, b: 640 };
    const s = placeSphere(1280, 860, text, true);
    expect(s.cx - s.R).toBeGreaterThan(text.r);
    const m = placeSphere(390, 860, { l: 0, t: 80, r: 390, b: 520 }, false);
    expect(m.cy - m.R).toBeGreaterThan(520);
  });
});
