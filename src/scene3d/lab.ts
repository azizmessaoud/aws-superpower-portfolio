/* Development lab: the baked brain, with its luminous layers switched on one at a time.
 *   ?view=lateral|three-quarter|front-quarter|top|front|back   &w=1280&h=720
 *   ?tier=full|mobile          (default: mobile under 700 px wide)
 *   ?layers=sfpntbd            s body, f fibres, p pulses, n branch nodes, t tips, b flowing beads, d particles
 *   ?body=ghost|solid|off      ghost: an invisible occluder plus a faint rim (the fibre-optic look); solid: the old sculpture
 *   ?rim=0.12                  strength of the ghost rim
 *   ?t=7.5                     freeze time (for repeatable stills); without it the lab animates
 * Not part of the production build; nothing in the site imports it. */
import {
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, BufferGeometry, Color, DirectionalLight, Group, HemisphereLight,
  Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, WebGLRenderer,
} from "three";
import { decodeBrain } from "./brainAsset";
import { createFiberLayers, createGhostBody, createParticles } from "./layers";
import fullUrl from "./assets/brain-full.brain?url";
import mobileUrl from "./assets/brain-mobile.brain?url";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "lateral";
const W = Number(q.get("w")) || innerWidth, H = Number(q.get("h")) || innerHeight;
const tier = q.get("tier") ?? (W < 700 ? "mobile" : "full");
const layers = q.get("layers") ?? "sfpntbd";
const body = q.get("body") ?? "ghost";
const rimStrength = Number(q.get("rim") ?? 0.1);
const fixedT = q.has("t") ? Number(q.get("t")) : null;
const FOV = 26;

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(W, H, false);
canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const dpr = renderer.getPixelRatio();

const scene = new Scene();
scene.background = new Color("#0a1929"); /* site --bg */

const camera = new PerspectiveCamera(FOV, W / H, 0.1, 50);
const aspect = W / H;
const R = Math.max(4.6, 1.3 / (Math.tan((FOV / 2) * Math.PI / 180) * aspect)), target = [0, -0.08, 0] as const;
const place = (x: number, y: number, z: number, up: [number, number, number] = [0, 1, 0]) => { camera.position.set(x, y, z); camera.up.set(...up); camera.lookAt(...target); };
const a = (deg: number) => (deg * Math.PI) / 180;
if (view === "top") place(0, R, 0.001, [0, 0, 1]);
else if (view === "front") place(0, 0.15, R);
else if (view === "back") place(0, 0.15, -R);
else if (view === "front-quarter") place(Math.cos(a(64)) * R, 0.7, Math.sin(a(64)) * R);
else if (view === "three-quarter") place(Math.cos(a(36)) * R, 0.75, Math.sin(a(36)) * R);
else place(R, -0.25, 0);
scene.add(camera);
const key = new DirectionalLight("#dcecff", 3.2); key.position.set(-3.2, 3.6, 2.4); camera.add(key);
const rim = new DirectionalLight("#8b5cf6", 2.1); rim.position.set(2.4, 1.2, -4); camera.add(rim);
const ice = new DirectionalLight("#e8f5ff", 2.2); ice.position.set(-3, 1.2, -3.2); camera.add(ice);
const under = new DirectionalLight("#3b82f6", 0.6); under.position.set(0.5, -3, 1.5); camera.add(under);
scene.add(new HemisphereLight("#6ea8ff", "#0a1929", 0.2), new AmbientLight("#8aa8d8", 0.05));

async function main() {
  const url = tier === "mobile" ? mobileUrl : fullUrl;
  const T: Record<string, number> = {};
  let t = performance.now();
  const res = await fetch(url);
  const gz = new Uint8Array(await res.arrayBuffer());
  T.fetchMs = performance.now() - t; t = performance.now();
  const raw = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  T.gunzipMs = performance.now() - t; t = performance.now();
  const brain = decodeBrain(raw);
  T.decodeMs = performance.now() - t; t = performance.now();

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(brain.positions, 3));
  geo.setIndex(new BufferAttribute(brain.index, 1));
  geo.computeVertexNormals();
  T.geometryMs = performance.now() - t; t = performance.now();

  /* vertex colour: muted blue crowns, deep navy groove bottoms; cerebellum and stem lean violet */
  const blue = new Color("#3b82f6").lerp(new Color("#a3b1c6"), 0.62).multiplyScalar(0.23), violet = new Color("#8b5cf6").lerp(new Color("#a3b1c6"), 0.55).multiplyScalar(0.22), groove = new Color("#050d18");
  const colors = new Float32Array(brain.sulcus.length * 3), c = new Color(), cv = blue.clone().lerp(violet, 0.65);
  for (let i = 0; i < brain.sulcus.length; i++) {
    c.copy(brain.part[i] === 0 ? blue : cv).lerp(groove, Math.pow(brain.sulcus[i]!, 0.8) * 0.92);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new BufferAttribute(colors, 3));
  const group = new Group();
  scene.add(group);
  if (layers.includes("s")) {
    if (body === "solid") group.add(new Mesh(geo, new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 })));
    else if (body === "ghost") group.add(...createGhostBody(geo, rimStrength).objects);
  }
  T.colorMs = performance.now() - t; t = performance.now();

  const fib = createFiberLayers(brain.fibers, {});
  if (layers.includes("f")) group.add(fib.ribbons);
  if (layers.includes("n")) group.add(fib.nodes);
  if (layers.includes("t")) group.add(fib.tips);
  fib.setBeads(layers.includes("b"));
  fib.setGain(tier === "mobile" ? 2.5 : 1.7);
  fib.setPulses(layers.includes("p"));
  const nrm = (geo.getAttribute("normal") as BufferAttribute).array as Float32Array;
  const nParticles = tier === "mobile" ? 700 : 1500;
  const parts = createParticles(brain.positions, nrm, nParticles);
  if (layers.includes("d")) group.add(parts.points);
  T.layersMs = performance.now() - t;

  const draw = (time: number) => {
    fib.update(time, W, H, FOV, dpr); parts.update(time, H, FOV, dpr);
    renderer.render(scene, camera);
  };
  draw(fixedT ?? 0);
  const entry = performance.getEntriesByType("resource").find((e) => /brain-(full|mobile)\.brain/.test(e.name) && (e as PerformanceResourceTiming).initiatorType === "fetch") as PerformanceResourceTiming | undefined;
  (window as unknown as { __lab: object }).__lab = {
    tier, layers, view, vertices: brain.positions.length / 3, triangles: brain.index.length / 3, fiberNodes: brain.fibers.parent.length,
    ribbonSegments: fib.segments, branchNodes: fib.branchNodes, particles: nParticles,
    bytesOnWire: gz.length, encodedBodySize: entry?.encodedBodySize, transferSize: entry?.transferSize,
    ...Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Math.round(v * 10) / 10])),
  };
  document.documentElement.dataset.ready = "1";
  if (fixedT === null) { const t0 = performance.now(); const loop = () => { draw((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}
main().catch((e) => { console.error(e); document.documentElement.dataset.error = String(e); });
