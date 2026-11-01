/* Where the 3D brain sits in the hero. Pure, so it can be tested: the brain must live in the free area beside the text on a wide
 * screen, or below it on a narrow one, and never be placed over the words. All values are CSS px, stage-relative. */
import type { Box } from "../scene/geometry";

export interface Placement { cx: number; cy: number; R: number }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** `text` is the box around the hero text (stage-relative), W/H the stage size. R is the radius of the disc the brain fills. */
export function placeBrain(W: number, H: number, text: Box | null): Placement {
  const right = text ? W - text.r : 0, below = text ? H - text.b : 0;
  /* beside the text whenever there is a usable column; the brain is about 1.9 R wide */
  if (right > 220) return { cx: text!.r + right / 2, cy: H / 2, R: Math.min(right / 2 - 38, H * 0.4) };
  /* otherwise under it, as large as the space allows, but never smaller than a readable brain */
  const R = clamp((below - 16) / 2, 70, W * 0.44);
  const top = text ? text.b : H / 2;
  return { cx: W / 2, cy: Math.min(top + 8 + R, H - R * 0.55), R };
}

/** The canvas is a square with the brain filling about 94% of its width. */
export const CANVAS_PER_R = 2.05;

export interface FlightInput {
  place: Placement; S: number; stageTop: number; stageH: number; H: number;
  /** scroll progress through the pinned hero, and the point where the flight to the nav begins */
  progress: number; dockAt: number;
  /** 0 in the hero, 1 landed in the nav (the 2D scene's eased value) */
  flight: number;
  /** 0..1, the entrance */
  entrance: number;
  dock: { cx: number; cy: number; r: number };
  reduced: boolean;
}
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);

/** Where the canvas goes and how it looks, from the scene's state: the flight to the nav in one pure place, so it is testable. */
export function heroTransform(i: FlightInput) {
  const cx = i.place.cx, cy = i.place.cy + i.stageTop;
  const sHero = (0.94 + 0.06 * i.entrance) * (1 + 0.1 * clamp(i.progress / i.dockAt, 0, 1));
  const sEnd = i.dock.r > 0 ? (i.dock.r * 2 * 1.1) / (i.S * 0.94) : 0.12;
  const scale = Math.exp(Math.log(sHero) + (Math.log(sEnd) - Math.log(sHero)) * i.flight);
  const x = cx + (i.dock.cx - cx) * i.flight - i.S / 2;
  const y = cy + (i.dock.cy - cy) * i.flight - i.S / 2;
  /* normally it fades over the last half of the flight, as the 2D scene fades its docked brain in; with reduced motion it fades as the hero scrolls away */
  const away = i.reduced ? clamp((i.stageTop + i.stageH) / (i.H * 0.6), 0, 1) : 1 - span(i.flight, 0.55, 0.95);
  return { x, y, scale, opacity: away * Math.min(1, i.entrance * 3), away };
}
