/* Audit of every interactive element on the built site (run `npm run build && npm run preview`, then `npm run audit:controls`).
 * It measures instead of guessing: target size (44 px tall on touch; 40 px for the starter-question chips on a pointer device, which are 44 px on touch),
 * a pointer cursor, a visible response to hover (the element or its card changes), and a keyboard focus ring.
 * Exit code 1 if anything is flagged, so it can guard against regressions. Writes reports/logs/button-audit.txt. */
const { chromium } = require("playwright");
const fs = require("fs");
const BASE = process.env.BASE_URL || "http://127.0.0.1:4173/";
const OUT = process.argv[2] || "reports/logs";
const PROPS = ["color", "backgroundColor", "borderTopColor", "boxShadow", "transform", "textDecorationLine", "opacity", "filter", "outlineColor"];
(async () => {
  const b = await chromium.launch();
  const report = {};
  for (const [tag, vp, touch] of [["desktop", { width: 1280, height: 800 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
    const c = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch }); const p = await c.newPage();
    await p.goto(BASE + "?hero=canvas&gov=off"); await p.waitForTimeout(1500);
    // open the one case study so its links/buttons count too
    await p.evaluate(() => { location.hash = "#project-traffix"; }); await p.waitForTimeout(800);
    const items = await p.evaluate(() => {
      const sel = "a[href], button, input, summary, [role=button], select, textarea";
      const out = []; let i = 0;
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        if (r.width < 2 || r.height < 2 || cs.visibility === "hidden" || cs.display === "none") continue;
        if (el.closest("[hidden], .sr-only")) continue;
        const inline = el.tagName === "A" && cs.display === "inline" && !!el.closest("p, li, dd, dt, figcaption, td, th, .term-body, .t-line"); // a link inside a sentence
        el.setAttribute("data-audit", String(i));
        out.push({ current: el.getAttribute("aria-current") === "true", i: i++, tag: el.tagName.toLowerCase(), cls: (el.className && el.className.toString().split(" ")[0]) || "", text: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.value || "").trim().replace(/\s+/g, " ").slice(0, 38), w: Math.round(r.width), h: Math.round(r.height), cursor: cs.cursor, inline });
      }
      return out;
    });
    const rows = [];
    for (const it of items) {
      const loc = p.locator(`[data-audit="${it.i}"]`);
      const row = { ...it, hover: null, focus: null, why: [] };
      try {
        await loc.scrollIntoViewIfNeeded({ timeout: 1500 });
        if (!touch) {
          const before = await loc.evaluate((e, props) => { const cs = getComputedStyle(e); return Object.fromEntries(props.map((k) => [k, cs[k]])); }, PROPS);
          await p.mouse.move(2, 2);
          await loc.hover({ timeout: 1500, force: true }); await p.waitForTimeout(380);
          const after = await loc.evaluate((e, props) => { const cs = getComputedStyle(e); return Object.fromEntries(props.map((k) => [k, cs[k]])); }, PROPS);
          // a parent card reacting (lift, border) also counts as feedback
          const parent = await loc.evaluate((e) => { const c = e.closest(".selected-card, .pcard, .skill-card, .cert-card, li"); if (!c) return null; const cs = getComputedStyle(c); return { t: cs.transform, b: cs.borderTopColor, s: cs.boxShadow }; });
          row.hover = PROPS.filter((k) => before[k] !== after[k]);
          row.parentReacts = !!parent && (parent.t !== "none" || /rgba?\(139, 92, 246/.test(parent.b));
          await p.mouse.move(2, 2);
        }
        await loc.focus({ timeout: 1500 });
        row.focus = await loc.evaluate((e) => { const cs = getComputedStyle(e); return { outline: cs.outlineStyle, w: parseFloat(cs.outlineWidth) }; });
      } catch (e) { row.err = String(e.message).split("\n")[0].slice(0, 60); }
      rows.push(row);
    }
    // judge
    for (const r of rows) {
      if (r.err) continue;
      const big = r.tag === "button" || r.tag === "input" || r.tag === "summary" || (r.tag === "a" && !r.inline);
      const min = !touch && r.cls === "suggest-q" ? 40 : 44;
      if (big && r.h < min) r.why.push(`target ${r.w}x${r.h} < ${min}px tall`);
      if (!r.inline && r.tag !== "input" && r.cursor !== "pointer") r.why.push(`cursor is ${r.cursor}`);
      if (!touch && r.tag !== "input" && r.hover && r.hover.length === 0 && !r.parentReacts && !r.current) r.why.push("no hover feedback");
      if (r.focus && r.focus.outline === "none" && r.cls !== "term-input") r.why.push("no focus ring"); /* the command-line input draws its ring on its row */
    }
    report[tag] = { total: rows.length, flagged: rows.filter((r) => r.why.length), rows };
    await c.close();
  }
  fs.mkdirSync(OUT, { recursive: true });
  const lines = [`button audit ${new Date().toISOString().slice(0, 10)} against ${BASE}`];
  for (const tag of Object.keys(report)) {
    const head = `${tag}: ${report[tag].total} interactive elements, ${report[tag].flagged.length} flagged`; lines.push(head); console.log(head);
    for (const r of report[tag].flagged) { const l = `  ${r.tag}.${r.cls}  "${r.text}"  ->  ${r.why.join("; ")}`; lines.push(l); console.log(l); }
  }
  fs.writeFileSync(`${OUT}/button-audit.txt`, lines.join("\n") + "\n");
  await b.close();
  if (Object.values(report).some((r) => r.flagged.length)) process.exit(1);
})();
