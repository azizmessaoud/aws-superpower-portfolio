import { describe, expect, it } from "vitest";
import { CANVAS_PER_R, placeBrain } from "../../src/scene3d/placement";

const box = (l: number, t: number, r: number, b: number) => ({ l, t, r, b });

describe("3D brain placement: never over the text", () => {
  it("wide screen: the whole canvas sits in the free column to the right of the text", () => {
    for (const [W, H, textR] of [[1280, 800, 740], [1440, 900, 790], [1920, 1080, 800], [1100, 760, 740]] as const) {
      const p = placeBrain(W, H, box(60, 90, textR, 700));
      const half = (p.R * CANVAS_PER_R) / 2;
      expect(p.cx - half, `${W}px: canvas left edge vs text right edge`).toBeGreaterThanOrEqual(textR - 0.1 * p.R); /* the corners of the square are empty; the brain itself is inside the disc */
      expect(p.cx - p.R, `${W}px: the brain disc clears the text`).toBeGreaterThanOrEqual(textR);
      expect(p.cx + p.R).toBeLessThanOrEqual(W);
      expect(p.cy - p.R).toBeGreaterThanOrEqual(0);
      expect(p.cy + p.R).toBeLessThanOrEqual(H);
    }
  });
  it("a medium window still puts a smaller brain beside the text, not a tiny one underneath", () => {
    const p = placeBrain(1024, 768, box(60, 90, 740, 650));
    expect(p.cx - p.R).toBeGreaterThanOrEqual(740);
    expect(p.R).toBeGreaterThan(100);
  });
  it("phone: below the text, centred, and never smaller than a readable brain", () => {
    for (const [W, H, tb] of [[390, 844, 660], [360, 740, 600], [320, 640, 560]] as const) {
      const p = placeBrain(W, H, box(16, 80, W - 16, tb));
      expect(p.cx).toBe(W / 2);
      expect(p.R).toBeGreaterThanOrEqual(70);
      /* on the shortest phones there is not room for a readable brain below the text: it may tuck behind the last row, by at most
         about two fifths of its radius, with the text always drawn above the canvas (checked end to end) */
      expect(p.cy - p.R, `${W}px: overlap with the text`).toBeGreaterThanOrEqual(tb - 0.45 * p.R);
      expect(p.cx - p.R).toBeGreaterThanOrEqual(0);
      expect(p.cx + p.R).toBeLessThanOrEqual(W);
    }
  });
  it("with no text measured yet it still returns finite, on-screen numbers", () => {
    const p = placeBrain(1280, 800, null);
    for (const v of [p.cx, p.cy, p.R]) expect(Number.isFinite(v)).toBe(true);
  });
});

import { heroTransform } from "../../src/scene3d/placement";
describe("the flight to the nav", () => {
  const base = { place: { cx: 1000, cy: 400, R: 250 }, S: 512, stageTop: 0, stageH: 800, H: 800, progress: 0, dockAt: 0.85, entrance: 1, dock: { cx: 1176, cy: 36, r: 16 }, reduced: false };
  it("starts in the free area at full size and visible", () => {
    const t = heroTransform({ ...base, flight: 0 });
    expect(t.x + base.S / 2).toBeCloseTo(1000, 3);
    expect(t.y + base.S / 2).toBeCloseTo(400, 3);
    expect(t.opacity).toBe(1);
    expect(t.scale).toBeGreaterThan(0.9);
  });
  it("ends on the dock, tiny, and invisible (the 2D scene's docked brain takes over)", () => {
    const t = heroTransform({ ...base, flight: 1 });
    expect(t.x + base.S / 2).toBeCloseTo(1176, 3);
    expect(t.y + base.S / 2).toBeCloseTo(36, 3);
    expect(t.scale).toBeLessThan(0.1);
    expect(t.opacity).toBe(0);
  });
  it("moves monotonically towards the dock, shrinks smoothly, and only fades in the second half", () => {
    let prev = heroTransform({ ...base, flight: 0 });
    for (let f = 0.05; f <= 1.0001; f += 0.05) {
      const t = heroTransform({ ...base, flight: f });
      expect(t.scale).toBeLessThanOrEqual(prev.scale + 1e-9);
      expect(t.y).toBeLessThanOrEqual(prev.y + 1e-9); /* the dock is above the hero centre */
      expect(t.x).toBeGreaterThanOrEqual(prev.x - 1e-9); /* and to the right */
      if (f <= 0.55) expect(t.opacity).toBe(1);
      prev = t;
    }
  });
  it("a slow entrance is invisible at first, fully visible by the end, without moving the brain", () => {
    expect(heroTransform({ ...base, flight: 0, entrance: 0 }).opacity).toBe(0);
    expect(heroTransform({ ...base, flight: 0, entrance: 1 }).opacity).toBe(1);
    expect(heroTransform({ ...base, flight: 0, entrance: 0 }).x).toBe(heroTransform({ ...base, flight: 0, entrance: 1 }).x);
  });
  it("reduced motion: no flight, it fades out as the hero scrolls away", () => {
    const top = heroTransform({ ...base, flight: 0, reduced: true }), gone = heroTransform({ ...base, flight: 0, reduced: true, stageTop: -800 });
    expect(top.opacity).toBe(1);
    expect(gone.opacity).toBe(0);
  });
});
