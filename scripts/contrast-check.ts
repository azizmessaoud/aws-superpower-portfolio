/* WCAG 2 contrast for every text/ground pair the components use, read from tokens.css. */
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
const tok = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
type RGBA = [number, number, number, number];
const parse = (v: string): RGBA => {
  if (v.startsWith("#")) { const h = v.slice(1); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as RGBA; }
  const m = v.match(/rgba?\(([^)]+)\)/)!;
  const p = m[1].split(",").map((x) => parseFloat(x));
  return [p[0], p[1], p[2], p[3] ?? 1];
};
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA;
const lum = (c: RGBA) => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const ratio = (a: RGBA, b: RGBA) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const color = (name: string) => parse(tok[name]);

/* ground = a token, or "glass5/<ground>" for a glass card over that ground */
const ground = (g: string): RGBA => (g.includes("/") ? over(color(g.split("/")[0]), color(g.split("/")[1])) : color(g));
const PAIRS: [string, string, number][] = [
  ...["bg", "bg-deep", "surface", "surface-v", "glass5/bg", "glass5/surface", "glass5/surface-v"].flatMap((g) => [
    ["fg", g, 4.5], ["fg-soft", g, 4.5], ["fg-muted", g, 4.5], ["violet-light", g, 4.5], ["cyan", g, 4.5],
  ] as [string, string, number][]),
  ["fg-lead", "bg", 4.5],
  ["on-primary", "primary", 4.5], ["on-primary", "blue-strong", 4.5],
  ["violet-light", "violet-tint/bg", 4.5], ["signal-red", "glass5/surface", 4.5], ["signal-amber", "glass5/surface", 4.5], ["signal-green", "glass5/surface", 4.5],
  ["focus-ring", "bg", 3], ["focus-ring", "surface", 3], ["focus-ring", "bg-deep", 3],
];
let fail = 0;
for (const [fg, bg, min] of PAIRS) {
  const f = fg === "focus-ring" ? color("violet-light") : color(fg);
  const r = ratio(over(f, ground(bg)), ground(bg));
  const ok = r >= min;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${fg.padEnd(13)} on ${bg.padEnd(18)} ${r.toFixed(2)}:1  (needs ${min}:1)`);
}
/* the brand violet is kept for non-text marks; show why it is not used for text */
console.log(`info  violet        on bg                 ${ratio(color("violet"), color("bg")).toFixed(2)}:1  (non-text only, needs 3:1)`);
if (fail) { console.error(`${fail} pair(s) below threshold`); process.exit(1); }
