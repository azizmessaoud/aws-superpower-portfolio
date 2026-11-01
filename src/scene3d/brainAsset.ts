/* The baked brain: one small binary the hero loads lazily instead of generating the brain on the visitor's device.
 *
 * What is stored: per-vertex positions (13-bit, delta-coded, one axis at a time so gzip sees long smooth runs), a fold-depth
 * byte per vertex, and the fibre network. What is NOT stored: triangles, part and hemisphere tags, normals. The vertex
 * order is a pure function of the subdivision counts (see icosphere.ts), so the loader rebuilds the index in a few ms
 * and Three.js recomputes normals. The whole payload is gzipped; transfer size equals file size.
 *
 * This file is the decoder AND the encoder, with no dependency on the generator, so the page only ships what it needs. */
import { icosphereIndex, tubeIndex } from "./icosphere";
import type { FiberNetwork } from "./fibers";

const MAGIC = 0x314e5242; /* "BRN1" little-endian */
const Q = 8191; /* 13-bit position grid */

export interface BrainMeta {
  v: 1;
  tier: string;
  seed: number;
  generator: string;
  subdivHemi: number;
  subdivCereb: number;
  stem: { rings: number; sides: number };
  counts: { hemi: number; cereb: number; stem: number; total: number };
  /** min x,y,z then max x,y,z of everything stored */
  bbox: [number, number, number, number, number, number];
  fibers: number;
  maxDist: number;
  pulseLen: number[];
}

export interface BrainAsset {
  meta: BrainMeta;
  positions: Float32Array;
  sulcus: Float32Array;
  /** 0 cerebrum, 1 cerebellum, 2 brainstem */
  part: Float32Array;
  /** +1 right hemisphere, -1 left, 0 elsewhere */
  hemi: Float32Array;
  index: Uint32Array;
  fibers: FiberNetwork;
}

const align = (n: number, a: number) => Math.ceil(n / a) * a;

function deltaEncodePlanar(values: Float32Array, lo: number[], hi: number[]): Int16Array {
  const n = values.length / 3, out = new Int16Array(n * 3);
  for (let axis = 0; axis < 3; axis++) {
    const span = hi[axis]! - lo[axis]! || 1;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const q = Math.round(((values[i * 3 + axis]! - lo[axis]!) / span) * Q);
      out[axis * n + i] = q - prev; prev = q;
    }
  }
  return out;
}

function deltaDecodePlanar(deltas: Int16Array, n: number, lo: number[], hi: number[]): Float32Array {
  const out = new Float32Array(n * 3);
  for (let axis = 0; axis < 3; axis++) {
    const span = hi[axis]! - lo[axis]! || 1;
    let q = 0;
    for (let i = 0; i < n; i++) { q += deltas[axis * n + i]!; out[i * 3 + axis] = lo[axis]! + (q / Q) * span; }
  }
  return out;
}

export function encodeBrain(a: { meta: Omit<BrainMeta, "bbox" | "fibers" | "maxDist" | "pulseLen">; positions: Float32Array; sulcus: Float32Array; fibers: FiberNetwork }): Uint8Array {
  const { positions, sulcus, fibers } = a;
  const V = positions.length / 3, N = fibers.parent.length;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const arr of [positions, fibers.pos]) for (let i = 0; i < arr.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, arr[i + k]!); hi[k] = Math.max(hi[k]!, arr[i + k]!);
  }
  let maxDist = 0;
  for (let i = 0; i < N; i++) maxDist = Math.max(maxDist, fibers.dist[i]!);
  const meta: BrainMeta = { ...a.meta, bbox: [lo[0]!, lo[1]!, lo[2]!, hi[0]!, hi[1]!, hi[2]!], fibers: N, maxDist, pulseLen: Array.from(fibers.pulseLen) };
  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));

  const pos = deltaEncodePlanar(positions, lo, hi);
  const sul = Uint8Array.from(sulcus, (s) => Math.round(Math.max(0, Math.min(1, s)) * 255));
  const fpos = deltaEncodePlanar(fibers.pos, lo, hi);
  const fpar = new Int32Array(N);
  for (let i = 0; i < N; i++) fpar[i] = fibers.parent[i]! < 0 ? 0 : i - fibers.parent[i]!;
  const fflow = Uint8Array.from(fibers.flow, (f) => Math.round(Math.max(0, Math.min(1, f)) * 255));
  const fdist = Uint16Array.from(fibers.dist, (d) => Math.round((d / (maxDist || 1)) * 65535));

  const head = 8 + metaBytes.length;
  let off = align(head, 4);
  const offs = { pos: off, sul: (off += pos.byteLength), fpos: 0, fpar: 0, fflow: 0, fdist: 0, fmask: 0, end: 0 };
  off = align(off + sul.byteLength, 4); offs.fpos = off;
  off += fpos.byteLength; offs.fpar = align(off, 4);
  off = offs.fpar + fpar.byteLength; offs.fflow = off;
  off += fflow.byteLength; offs.fdist = align(off, 2);
  off = offs.fdist + fdist.byteLength; offs.fmask = off;
  offs.end = off + N;

  const out = new Uint8Array(offs.end);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, metaBytes.length, true);
  out.set(metaBytes, 8);
  out.set(new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength), offs.pos);
  out.set(sul, offs.sul);
  out.set(new Uint8Array(fpos.buffer, fpos.byteOffset, fpos.byteLength), offs.fpos);
  out.set(new Uint8Array(fpar.buffer, fpar.byteOffset, fpar.byteLength), offs.fpar);
  out.set(fflow, offs.fflow);
  out.set(new Uint8Array(fdist.buffer, fdist.byteOffset, fdist.byteLength), offs.fdist);
  out.set(fibers.mask, offs.fmask);
  void V;
  return out;
}

export function decodeBrain(input: Uint8Array): BrainAsset {
  /* typed-array views need aligned offsets: copy if this view does not start on a 4-byte boundary */
  const u8 = input.byteOffset % 4 === 0 ? input : input.slice();
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (dv.getUint32(0, true) !== MAGIC) throw new Error("not a brain asset");
  const metaLen = dv.getUint32(4, true);
  const meta = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + metaLen))) as BrainMeta;
  const V = meta.counts.total, N = meta.fibers;
  const lo = meta.bbox.slice(0, 3), hi = meta.bbox.slice(3, 6);

  let off = align(8 + metaLen, 4);
  const posD = new Int16Array(u8.buffer, u8.byteOffset + off, V * 3); off += V * 6;
  const sulB = u8.subarray(off, off + V); off += V; off = align(off, 4);
  const fposD = new Int16Array(u8.buffer, u8.byteOffset + off, N * 3); off += N * 6; off = align(off, 4);
  const fparD = new Int32Array(u8.buffer, u8.byteOffset + off, N); off += N * 4;
  const fflowB = u8.subarray(off, off + N); off += N; off = align(off, 2);
  const fdistD = new Uint16Array(u8.buffer, u8.byteOffset + off, N); off += N * 2;
  const fmaskB = u8.subarray(off, off + N);

  const positions = deltaDecodePlanar(posD, V, lo, hi);
  const sulcus = Float32Array.from(sulB, (s) => s / 255);

  /* topology and tags from the counts alone */
  const { hemi: Vh, cereb: Vc, stem: Vs } = meta.counts;
  const part = new Float32Array(V), hemi = new Float32Array(V);
  part.fill(1, 2 * Vh, 2 * Vh + Vc); part.fill(2, 2 * Vh + Vc, V);
  hemi.fill(1, 0, Vh); hemi.fill(-1, Vh, 2 * Vh);
  const ih = icosphereIndex(meta.subdivHemi), ic = icosphereIndex(meta.subdivCereb), is = tubeIndex(meta.stem.rings, meta.stem.sides);
  const index = new Uint32Array(ih.length * 2 + ic.length + is.length);
  let o = 0;
  for (let t = 0; t < ih.length; t += 3) { index[o++] = ih[t]!; index[o++] = ih[t + 1]!; index[o++] = ih[t + 2]!; }
  for (let t = 0; t < ih.length; t += 3) { index[o++] = ih[t]! + Vh; index[o++] = ih[t + 2]! + Vh; index[o++] = ih[t + 1]! + Vh; } /* mirrored: winding flips */
  for (let t = 0; t < ic.length; t++) index[o++] = ic[t]! + 2 * Vh;
  for (let t = 0; t < is.length; t++) index[o++] = is[t]! + 2 * Vh + Vc;
  void Vs;

  const parent = new Int32Array(N);
  for (let i = 0; i < N; i++) parent[i] = fparD[i] === 0 ? -1 : i - fparD[i]!;
  const fibers: FiberNetwork = {
    pos: deltaDecodePlanar(fposD, N, lo, hi),
    parent,
    flow: Float32Array.from(fflowB, (f) => f / 255),
    dist: Float32Array.from(fdistD, (d) => (d / 65535) * meta.maxDist),
    mask: Uint8Array.from(fmaskB),
    pulseLen: Float32Array.from(meta.pulseLen),
  };
  return { meta, positions, sulcus, part, hemi, index, fibers };
}

/** Fetch, gunzip and decode a baked brain. Throws if the browser cannot gunzip (the caller keeps the 2D hero).
 *  If something in between already decompressed the file (some proxies do), it is used as it is. */
export async function loadBrain(url: string, signal?: AbortSignal): Promise<BrainAsset> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`brain asset: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === "undefined") throw new Error("DecompressionStream is not available");
    return decodeBrain(new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()));
  }
  return decodeBrain(bytes);
}
