/* Fails when the built site exceeds its size budgets. Run after `npm run build`:  npm run check:budget
 *   JS budgets are gzip bytes (what a visitor downloads over a compressing server).
 *   The 3D hero's JavaScript budget is the one you set: 180 kB gzip, for the lazily loaded chunk only.
 *   Geometry assets have their own, separate budgets (proposed here, change them if you disagree): they are gzip files already,
 *   so the size on disk is the size on the wire. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const DIST = new URL("../dist/assets/", import.meta.url);
const files = readdirSync(DIST);
const find = (re: RegExp) => { const f = files.find((n) => re.test(n)); if (!f) throw new Error(`no built file matches ${re}`); return f; };
const gz = (f: string) => gzipSync(readFileSync(new URL(f, DIST)), { level: 9 }).length;
const raw = (f: string) => statSync(new URL(f, DIST)).size;

const rows: { name: string; bytes: number; limit: number; what: string }[] = [
  { name: find(/^index-.*\.js$/), bytes: 0, limit: 85_000, what: "main bundle (page, 2D scene glue), gzip" },
  { name: find(/^NeuralScene-.*\.js$/), bytes: 0, limit: 12_000, what: "2D scene chunk, gzip" },
  { name: find(/^HeroBrain-.*\.js$/), bytes: 0, limit: 180_000, what: "3D hero chunk (Three.js + renderer), gzip: YOUR 180 kB BUDGET" },
];
rows.forEach((r) => (r.bytes = gz(r.name)));
rows.push(
  { name: find(/^brain-full-.*\.brain$/), bytes: raw(find(/^brain-full-.*\.brain$/)), limit: 450_000, what: "full geometry asset, on the wire (proposed budget)" },
  { name: find(/^brain-mobile-.*\.brain$/), bytes: raw(find(/^brain-mobile-.*\.brain$/)), limit: 180_000, what: "mobile geometry asset, on the wire (proposed budget)" },
);
let bad = 0;
for (const r of rows) {
  const ok = r.bytes <= r.limit; if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${(r.bytes / 1000).toFixed(1).padStart(7)} kB / ${(r.limit / 1000).toFixed(0).padStart(3)} kB  ${r.what}  (${r.name})`);
}
console.log(bad ? `\n${bad} budget(s) exceeded` : "\nall budgets met");
process.exit(bad ? 1 : 0);
