/* Pure geometry for the hero scene: the point-cloud brain and the skill sphere (ported from
 * projectx0 main: client/src/components/NeuralField.tsx). No DOM, so it is unit-tested. */
import { hash01 } from "./rng";

export const BRAIN_SCALE = 1.4;

export function seedBrain(count: number): Float32Array {
  const pts = new Float32Array(count * 3);
  let n = 0;
  for (let k = 0; n < count && k < count * 30; k++) {
    const u = hash01(k, 11), v = hash01(k, 12), w = hash01(k, 13);
    let x: number, y: number, z: number;
    if (w < 0.95) {
      const hemi = w < 0.86, side = w < 0.43 ? -1 : 1;
      const [cx, cy, cz, rx, ry, rz] = hemi ? [side * 0.13, -0.04, 0.02, 0.27, 0.3, 0.46] : [0, 0.24, -0.3, 0.26, 0.11, 0.15];
      const th = u * Math.PI * 2, cp = v * 2 - 1, sp = Math.sqrt(1 - cp * cp);
      const dx = sp * Math.cos(th), dy = cp, dz = sp * Math.sin(th);
      const rip = hemi ? 1 + 0.07 * Math.sin(dz * 18 + dy * 7) * Math.sin(dy * 16 - dx * 5) : 1 + 0.04 * Math.sin(dx * 30);
      x = cx + dx * rx * rip; y = cy + dy * ry * rip; z = cz + dz * rz * rip;
      if (hemi && (side * x < 0.025 || y > cy + ry * 0.78)) continue;
    } else {
      x = (v - 0.5) * 0.08; y = 0.16 + u * 0.34; z = -0.1 - u * 0.1 + (hash01(k, 14) - 0.5) * 0.06;
    }
    pts[n * 3] = x * BRAIN_SCALE; pts[n * 3 + 1] = y * BRAIN_SCALE; pts[n * 3 + 2] = z * BRAIN_SCALE;
    n++;
  }
  return pts.subarray(0, n * 3);
}

export interface ShellNode { x: number; y: number; z: number; phase: number; drift: number; bright: boolean; label?: string }

export function seedShell(count: number, labels: readonly string[]): ShellNode[] {
  const list: ShellNode[] = Array.from({ length: count }, (_, i) => {
    const y = 1 - ((i + 0.5) / count) * 2, ring = Math.sqrt(1 - y * y), th = i * 2.399963, r = 0.92 + hash01(i, 21) * 0.12;
    return { x: Math.cos(th) * ring * r, y: y * r, z: Math.sin(th) * ring * r, phase: i * 0.73, drift: 0.55 + hash01(i, 5) * 0.7, bright: hash01(i, 22) > 0.8 };
  });
  const step = count / Math.max(1, labels.length);
  labels.forEach((l, i) => { list[Math.floor(i * step + step / 2) % count].label = l; });
  return list;
}

export interface Edge { from: number; to: number; d: number }

/** Each node links to its nearest neighbours within 0.75 (undirected, no duplicates). */
export function buildEdges(nodes: ShellNode[], neighbors: number): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];
  nodes.forEach((a, i) => {
    nodes.map((b, j) => ({ from: i, to: j, d: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) }))
      .filter((e) => e.from !== e.to && e.d < 0.75)
      .sort((p, q) => p.d - q.d)
      .slice(0, neighbors)
      .forEach((e) => {
        const key = `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`;
        if (!seen.has(key)) { seen.add(key); edges.push(e); }
      });
  });
  return edges;
}

/** Camera zoom for a moment of the sequence: pull back on open (intro 0→1), dolly in with scroll (0→1). */
export const ZOOM_OPEN = 2.6;
export const ZOOM_DEEP = 3.4;
export function cameraZoom(intro: number, scroll: number) {
  const e = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  return ZOOM_OPEN + (1 - ZOOM_OPEN) * e(intro) + (ZOOM_DEEP - 1) * e((scroll - 0.05) / 0.95);
}

export interface Box { l: number; t: number; r: number; b: number }

/** Where the sphere sits: in the free area right of the text if there is room, else below it. */
export function placeSphere(W: number, H: number, text: Box | null, labels: boolean) {
  const right = text ? W - text.r : 0, below = text ? H - text.b : 0;
  if (right > 280) return { cx: text!.r + right / 2, cy: H / 2, R: Math.min(right / 2 - (labels ? 70 : 24), H * 0.34) };
  const R = Math.max(48, Math.min((below - 88) / 2, W * 0.38));
  return { cx: W / 2, cy: (text ? text.b : H / 2) + 8 + R, R };
}
