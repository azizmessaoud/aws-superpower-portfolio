/* Development lab for milestone 1: the bare sculpture, no particles, filaments or glow.
 * ?view=lateral|three-quarter|top|front|back  &w=1280&h=720  &fold=1  &detail=60 */
import {
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, Color, DirectionalLight, HemisphereLight, Mesh,
  MeshPhysicalMaterial, PerspectiveCamera, Scene, WebGLRenderer,
} from "three";
import { buildBrain, PART } from "./brainGeometry";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "lateral";
const W = Number(q.get("w")) || innerWidth, H = Number(q.get("h")) || innerHeight;

const canvas = document.getElementById("c") as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(W, H, false);
canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

/* site tokens: --bg #0a1929, --blue #3b82f6, --violet #8b5cf6 */
const scene = new Scene();
scene.background = new Color("#0a1929");

const t0 = performance.now();
const geo = buildBrain({ seed: 7, detail: Number(q.get("detail")) || 60, foldDepth: Number(q.get("fold") ?? 1) });
const buildMs = performance.now() - t0;

/* vertex colour: crown of each fold in a muted blue, groove bottoms deep navy; cerebellum and stem lean violet */
const sulcus = geo.getAttribute("sulcus") as BufferAttribute, part = geo.getAttribute("part") as BufferAttribute;
const blue = new Color("#3b82f6").lerp(new Color("#a3b1c6"), 0.62).multiplyScalar(0.23), violet = new Color("#8b5cf6").lerp(new Color("#a3b1c6"), 0.55).multiplyScalar(0.22), groove = new Color("#050d18");
const colors = new Float32Array(sulcus.count * 3), c = new Color();
for (let i = 0; i < sulcus.count; i++) {
  c.copy(part.getX(i) === PART.cerebrum ? blue : blue.clone().lerp(violet, 0.65));
  c.lerp(groove, Math.pow(sulcus.getX(i), 0.8) * 0.92);
  colors.set([c.r, c.g, c.b], i * 3);
}
geo.setAttribute("color", new BufferAttribute(colors, 3));

const mesh = new Mesh(geo, new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.32 }));
scene.add(mesh);

const camera = new PerspectiveCamera(26, W / H, 0.1, 50);
/* pull the camera back until the brain fits the canvas width as well as its height */
const aspect = W / H;
const R = Math.max(4.6, 1.3 / (Math.tan((26 / 2) * Math.PI / 180) * aspect)), target = [0, -0.08, 0] as const;
const place = (x: number, y: number, z: number, up: [number, number, number] = [0, 1, 0]) => {
  camera.position.set(x, y, z); camera.up.set(...up); camera.lookAt(...target);
};
const a = (deg: number) => (deg * Math.PI) / 180;
if (view === "top") place(0, R, 0.001, [0, 0, 1]);
else if (view === "front") place(0, 0.15, R);
else if (view === "back") place(0, 0.15, -R);
else if (view === "three-quarter") place(Math.cos(a(36)) * R, 0.75, Math.sin(a(36)) * R);
else place(R, -0.25, 0);
camera.lookAt(...target);

/* lights ride on the camera, so each view is lit the same way: cool key high and in front, violet rim behind */
scene.add(camera);
const key = new DirectionalLight("#dcecff", 3.2); key.position.set(-3.2, 3.6, 2.4); camera.add(key);
const rim = new DirectionalLight("#8b5cf6", 2.1); rim.position.set(2.4, 1.2, -4); camera.add(rim);
const ice = new DirectionalLight("#e8f5ff", 2.2); ice.position.set(-3, 1.2, -3.2); camera.add(ice);
const under = new DirectionalLight("#3b82f6", 0.6); under.position.set(0.5, -3, 1.5); camera.add(under);
scene.add(new HemisphereLight("#6ea8ff", "#0a1929", 0.2), new AmbientLight("#8aa8d8", 0.05));

renderer.render(scene, camera);
(window as unknown as { __lab: object }).__lab = { buildMs, vertices: geo.getAttribute("position").count, triangles: (geo.getIndex()?.count ?? 0) / 3 };
document.documentElement.dataset.ready = "1";
