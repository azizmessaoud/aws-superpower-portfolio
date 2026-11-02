import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/* The palette is a decision (docs/design-decisions.md, 2 Nov 2026): warm graphite, bone text, one verdigris accent, no gradients or glows.
 * The prototype's navy, violet and cyan looked generic. This keeps them from creeping back in. */
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? (n === "generated" || n === "assets" ? [] : walk(p)) : /\.(css|ts|tsx)$/.test(n) ? [p] : []; });
const files = walk("src");
const text = (f: string) => readFileSync(f, "utf8");

describe("the old palette is gone", () => {
  const OLD_HEX = ["#8b5cf6", "#06b6d4", "#22d3ee", "#a78bfa", "#3b82f6", "#2563eb", "#5a20b6", "#0a1929", "#060f1a", "#0d1f33", "#0e0c1e", "#42b7ff", "#8b7cf6"];
  const OLD_RGB = ["139, ?92, ?246", "6, ?182, ?212", "34, ?211, ?238", "167, ?139, ?250", "59, ?130, ?246", "248, ?250, ?252", "10, ?25, ?41"];
  it("no file under src uses a navy, violet or cyan colour", () => {
    const hits: string[] = [];
    for (const f of files) {
      const t = text(f).toLowerCase();
      for (const h of OLD_HEX) if (t.includes(h)) hits.push(`${f}: ${h}`);
      for (const r of OLD_RGB) if (new RegExp(`\\b${r}\\b`).test(t)) hits.push(`${f}: rgb ${r}`);
    }
    expect(hits).toEqual([]);
  });
  it("no token or class is named after a hue that is no longer used", () => {
    const hits = files.filter((f) => /--(violet|cyan|blue)\b|--(violet|cyan)-/.test(text(f)));
    expect(hits).toEqual([]);
  });
});

describe("no gradients or glows decorate the brand", () => {
  const tokens = text("src/styles/tokens.css");
  it("the brand gradient tokens are single colours", () => {
    for (const m of tokens.matchAll(/--grad[\w-]*:\s*([^;]+);/g)) expect(m[1], m[0]).not.toMatch(/gradient/);
  });
  it("no coloured glow shadows or text shadows remain in the styles", () => {
    const css = text("src/styles/base.css");
    expect(css).not.toMatch(/text-shadow/);
    expect(css).not.toMatch(/drop-shadow\([^)]*rgba/);
    expect(css).not.toMatch(/box-shadow:[^;]*rgba\((?!0, 0, 0)/);   /* shadows are black; coloured ones were glows */
  });
  it("the one accent is verdigris", () => {
    expect(tokens).toMatch(/--accent:\s*#5fb3a1/);
    expect(tokens).not.toMatch(/--(violet|cyan)/);
  });
});
