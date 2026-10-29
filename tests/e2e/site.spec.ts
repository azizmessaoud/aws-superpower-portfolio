import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => list.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && list.push(m.text()));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

const shot = (page: Page, name: string, project: string) => page.screenshot({ path: `reports/screens/${project}-${name}.png` });
const frames = (page: Page) => page.evaluate(() => (window as unknown as { __scene?: { frames: number } }).__scene?.frames ?? -1);
const runway = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>(".hero-runway")!.offsetHeight);

test("hero sequence: start, middle, end; text stays clear; no overflow", async ({ page }, info) => {
  await page.goto("/?seed=7");
  await page.waitForTimeout(2200);
  await shot(page, "hero-start", info.project.name);
  const run = await runway(page);
  expect(run).toBeGreaterThan(0);
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), Math.round(run * 0.45));
  await page.waitForTimeout(600);
  await shot(page, "hero-middle", info.project.name);
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), run);
  await page.waitForTimeout(600);
  await shot(page, "hero-end", info.project.name);
  /* the headline and lead never move while the camera does */
  const box = await page.locator(".hero-h1").boundingBox();
  expect(box!.y).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("full page renders without horizontal overflow", async ({ page }, info) => {
  await page.goto("/");
  for (let y = 0; y < 9000; y += 700) { await page.evaluate((v) => scrollTo({ top: v, behavior: "instant" }), y); await page.waitForTimeout(40); }
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `reports/screens/${info.project.name}-full.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("scene stops while the hero is offscreen", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(600);
  await page.evaluate(() => scrollTo({ top: document.getElementById("projects")!.offsetTop, behavior: "instant" }));
  await page.waitForTimeout(400);
  const f = await frames(page);
  await page.waitForTimeout(800);
  expect(await frames(page)).toBe(f);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("one still frame, no pinning, no pause button, content visible", async ({ page }, info) => {
    await page.goto("/");
    await page.waitForTimeout(800);
    expect(await runway(page)).toBe(0);
      const f = await frames(page);
    await page.waitForTimeout(600);
    expect(await frames(page)).toBe(f);
    await expect(page.locator(".hero-h1")).toHaveCSS("opacity", "1");
    await shot(page, "reduced", info.project.name);
  });
});

test("ask my brain terminal: evidence with links, honest no-result, suggestions", async ({ page }, info) => {
  await page.goto("/#terminal");
  const input = page.locator("#term-input");
  const log = page.getByRole("log", { name: "Terminal output" });
  await input.fill("ask Are ambulances faster with TraffiX?");
  await input.press("Enter");
  await expect(log).toContainText("Ambulances are slower");
  await expect(log.locator("a[href*='github.com/azizmessaoud/traffix/blob/d54b071']").first()).toBeVisible();
  await page.locator("#terminal").screenshot({ path: `reports/screens/${info.project.name}-terminal-results.png` });
  await input.fill("ask What is your IQ?");
  await input.press("Enter");
  await expect(log).toContainText("No verified passage");
  await page.getByRole("button", { name: /What did you personally build in the TraffiX team/ }).click();
  await expect(log).toContainText("TraffiX");
  await page.getByRole("button", { name: /How did you avoid data leakage/ }).click();
  await expect(log).toContainText("leakage", { ignoreCase: true });
});


test("the about section shows my portrait with a text alternative", async ({ page }) => {
  await page.goto("/#about");
  const img = page.getByRole("img", { name: "Portrait of Aziz Messaoud" });
  await img.scrollIntoViewIfNeeded();
  await expect(img).toBeVisible();
  expect(await img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
});

test("there is no pause button; reduced motion is still honoured by the media query", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /motion/i })).toHaveCount(0);
});

test("certifications link out to each issuer", async ({ page }) => {
  await page.goto("/#certifications");
  const sec = page.locator("#certifications");
  await expect(sec.getByRole("link", { name: /Verify with Oracle/ })).toHaveCount(2);
  await expect(sec.getByRole("link", { name: /Verify with Microsoft/ })).toHaveCount(2);
  await expect(sec.getByRole("link", { name: /Verify with Databricks/ })).toHaveCount(1);
  expect(await sec.locator(".cert-learning > li").count()).toBe(11);
});

test("keyboard focus is always visible", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard path checked on desktop");
  await page.goto("/");
  const seen: string[] = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    const r = await page.evaluate(() => { const e = document.activeElement as HTMLElement; const s = getComputedStyle(e); return { tag: e.tagName, outline: s.outlineStyle, w: s.outlineWidth, label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24) }; });
    seen.push(r.label);
    expect(r.outline, `focus ring on ${r.label}`).toBe("solid");
    expect(r.w).toBe("2px");
  }
  expect(seen[0]).toMatch(/Skip to content/);
});

test("mobile menu opens, closes with Escape and returns focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "menu exists below 760px");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Menu" });
  await toggle.tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
  await shot(page, "menu", info.project.name);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toBeFocused();
  await toggle.tap();
  await page.getByRole("link", { name: "Skills", exact: true }).tap();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("touch drag on the hero scrolls the page", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 650 }] });
  for (let y = 600; y >= 300; y -= 50) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(100);
});

test("no layout shift while loading", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBeLessThan(0.05);
});

test("axe-core: no serious or critical violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2000);
  await page.locator("#term-input").fill("ask How do you process scanned documents?");
  await page.locator("#term-input").press("Enter");
  await expect(page.getByRole("log", { name: "Terminal output" })).toContainText("Docling");
  // @axe-core/playwright 4.10 types Page against an older Playwright; the runtime API is the same.
  const r = await new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"] }).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test("hero text is readable within 800 ms (the intro never hides it for long)", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  await expect(page.locator(".hero-h1")).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-lead")).toHaveCSS("opacity", "1");
});

test("runs under the production CSP from customHttp.yml without violations", async ({ page }) => {
  const yml = (await import("node:fs")).readFileSync("customHttp.yml", "utf8");
  const csp = yml.match(/Content-Security-Policy\s*\n\s*value: "([^"]+)"/)![1];
  const violations: string[] = [];
  page.on("console", (m) => /Content Security Policy/i.test(m.text()) && violations.push(m.text()));
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, headers: { ...res.headers(), "content-security-policy": csp } });
  });
  await page.goto("/");
  await page.waitForTimeout(1500);
  await page.locator("#term-input").fill("ask How do you process scanned documents?");
  await page.locator("#term-input").press("Enter");
  await expect(page.getByRole("log", { name: "Terminal output" })).toContainText("Docling");
  expect(await page.evaluate(() => document.documentElement.classList.contains("js"))).toBe(true);
  expect(violations).toEqual([]);
});

const scrollPage = (page: Page, y: number) => page.evaluate((v) => window.scrollTo({ top: v, behavior: "instant" }), y);
const running = (page: Page) => page.evaluate(() => (window as unknown as { __scene?: { running: boolean } }).__scene?.running ?? false);

test("the brain docks into the nav's Ask my brain link; it is a keyboard-reachable hint", async ({ page }, info) => {
  await page.goto("/");
  await page.waitForTimeout(1200);
  const cta = page.locator(".nav-cta");
  await expect(cta).toBeVisible();                       /* the hint is in the nav from the first screen */
  await expect(cta).not.toHaveClass(/is-docked/);
  const run = await runway(page);
  await scrollPage(page, Math.round(run * 0.9));
  await page.waitForTimeout(330);                         /* mid-flight */
  await page.screenshot({ path: `reports/screens/${info.project.name}-docking.png` });
  await scrollPage(page, run + 400);
  await page.waitForTimeout(600);
  await expect(cta).toHaveClass(/is-docked/);
  await page.screenshot({ path: `reports/screens/${info.project.name}-docked.png` });
  await page.locator(".nav").screenshot({ path: `reports/screens/${info.project.name}-docked-nav.png` });
  expect(await running(page)).toBe(false);               /* nothing animates while the docked brain is idle */
  await cta.focus();
  await page.waitForTimeout(300);
  expect(await running(page)).toBe(true);                /* focus wakes it */
  await page.keyboard.press("Enter");
  await expect(page.locator("#hero-ask")).toBeFocused();
});

test.describe("reduced motion dock", () => {
  test.use({ reducedMotion: "reduce" });
  test("still brain docks once the hero leaves; nothing loops", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(600);
    await scrollPage(page, 900);
    await page.waitForTimeout(500);
    await expect(page.locator(".nav-cta")).toHaveClass(/is-docked/);
    await page.locator(".nav-cta").hover();
    await page.waitForTimeout(300);
    expect(await running(page)).toBe(false);
  });
});

test("the docked brain is actually drawn inside its socket", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  await scrollPage(page, (await runway(page)) + 400);
  await page.waitForTimeout(1000);
  const lit = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".brain-canvas")!, r = document.querySelector(".nav-cta .dock-brain")!.getBoundingClientRect();
    const k = c.width / innerWidth, d = c.getContext("2d")!.getImageData(Math.round(r.left * k), Math.round(r.top * k), Math.round(r.width * k), Math.round(r.height * k)).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++;
    return n;
  });
  expect(lit).toBeGreaterThan(50);
});

test("skip link is visible whenever it has focus, even after wrapping from the page end", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.locator(".skip").focus();
  const r = await page.locator(".skip").boundingBox();
  expect(r!.y).toBeGreaterThanOrEqual(0);
  expect(r!.y + r!.height).toBeLessThanOrEqual(860);
});

test("terminal explorer: keyboard, suggestions, history, no Tab trap, evidence links", async ({ page }, info) => {
  await page.goto("/#terminal");
  const input = page.locator("#term-input");
  await input.fill("project flyrank");
  await input.press("Enter");
  const log = page.getByRole("log", { name: "Terminal output" });
  await expect(log).toContainText("Precision@50: 0.94");
  await expect(log).toContainText("Observational, not causal");
  await input.fill("ask What is the OCR accuracy on real documents?");
  await input.press("Enter");
  await expect(log).toContainText("has not been measured");
  await expect(log.getByRole("link").last()).toHaveAttribute("href", /github\.com\/azizmessaoud\//);
  await input.press("ArrowUp");
  await expect(input).toHaveValue(/^ask What is the OCR accuracy/);
  await input.fill("");
  await input.press("Tab");                                  /* Tab must leave the input */
  await expect(input).not.toBeFocused();
  await page.getByRole("button", { name: "projects", exact: true }).click();
  await expect(log).toContainText("HR document checks");
  await page.locator(".terminal-section").screenshot({ path: `reports/screens/${info.project.name}-terminal.png` });
});

test("tech superpowers: seven cards, every evidenced card links to a repository", async ({ page }, info) => {
  await page.goto("/#skills");
  const cards = page.locator("#skills .skill-card");
  await expect(cards).toHaveCount(7);
  const links = page.locator("#skills .skill-evidence");
  await expect(links).toHaveCount(6);
  for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/^https:\/\/github\.com\/(azizmessaoud|EyaLaourine)\//);
  await page.locator("#skills").screenshot({ path: `reports/screens/${info.project.name}-skills.png` });
});

test("the neural field fills the whole hero background, not only the sphere", async ({ page }) => {
  await page.goto("/?seed=7");
  await page.waitForTimeout(2000);
  const lit = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>(".brain-canvas")!, k = c.width / innerWidth, ctx = c.getContext("2d")!;
    const count = (x0: number, x1: number) => { const d = ctx.getImageData(Math.round(x0 * k), 0, Math.round((x1 - x0) * k), Math.round(innerHeight * k)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; };
    return { left: count(0, innerWidth / 3), right: count((2 * innerWidth) / 3, innerWidth) };
  });
  expect(lit.left).toBeGreaterThan(200);                     /* the field reaches the text side too */
  expect(lit.right).toBeGreaterThan(200);
});

test("the network flows behind the hero text instead of stopping at a box around it", async ({ page }) => {
  await page.goto("/?seed=7");
  await page.waitForTimeout(2000);
  /* the brightest canvas pixel inside the text column, over ~1 s of drift */
  const peak = await page.evaluate(async () => {
    const c = document.querySelector<HTMLCanvasElement>(".brain-canvas")!, k = c.width / innerWidth, ctx = c.getContext("2d")!;
    const range = document.createRange(); let l = 1e9, t = 1e9, r = 0, b = 0;
    for (const el of document.querySelectorAll(".hero-inner > *")) {
      range.selectNodeContents(el); const q = range.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    let max = 0;
    for (let f = 0; f < 10; f++) {
      const d = ctx.getImageData(Math.round(l * k), Math.round(t * k), Math.round((r - l) * k), Math.round((b - t) * k)).data;
      for (let i = 3; i < d.length; i += 4) max = Math.max(max, d[i]);
      await new Promise((res) => setTimeout(res, 100));
    }
    return max;
  });
  expect(peak).toBeGreaterThan(120);                         /* the old box cut-out capped everything in it near 30 */
});

test("stopping the scroll mid-way never leaves the brain hanging: it finishes the flight", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  const run = await runway(page);
  await scrollPage(page, Math.round(run * 0.87));         /* just past the threshold, then stop */
  await expect(page.locator(".nav-cta")).toHaveClass(/is-docked/, { timeout: 2000 });
  await page.waitForTimeout(150);
  expect(await running(page)).toBe(false);               /* landed, loop idle */
  await scrollPage(page, Math.round(run * 0.5));          /* scroll back above it: the brain flies back out */
  await expect(page.locator(".nav-cta")).not.toHaveClass(/is-docked/);
});

test("clicking on the hero text still sends a pulse through the network", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "hover/click journey is for pointer devices");
  await page.goto("/");
  await page.waitForTimeout(1500);
  const pulses = () => page.evaluate(() => (window as unknown as { __scene: { pulseCount: number } }).__scene.pulseCount);
  const before = await pulses();
  await page.locator(".hero-lead").click({ position: { x: 40, y: 20 } });
  expect(await pulses()).toBeGreaterThan(before);
  /* a real control keeps its own click and sends no pulse */
  const mid = await pulses();
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Skills" }).click();
  expect(await pulses()).toBeLessThanOrEqual(mid);
});


test("the terminal understands a plain question about certifications", async ({ page }, info) => {
  await page.goto("/#terminal");
  const input = page.locator("#term-input");
  const log = page.getByRole("log", { name: "Terminal output" });
  await input.fill("whats aziz certifs");
  await input.press("Enter");
  await expect(log).toContainText("OCI Data Science Professional");
  await expect(log).not.toContainText("command not found");
  await expect(log.getByRole("link", { name: /Azure AI Fundamentals/ })).toHaveAttribute("href", /learn\.microsoft\.com/);
  await input.fill("do you have the AWS cloud practitioner certificate?");
  await input.press("Enter");
  await expect(log).toContainText("none is claimed");
  await page.locator("#terminal").screenshot({ path: `reports/screens/${info.project.name}-terminal-certs.png` });
});

test("every project ends with the same four-part label", async ({ page }) => {
  await page.goto("/#projects");
  const labels = page.locator(".plabel");
  await expect(labels).toHaveCount(3);
  for (const l of await labels.all()) {
    await expect(l.locator("dt")).toHaveText([/Data/, /How it was judged/, /Where it fails/, /Who reviews the output/]);
  }
});

/* ── the demo flow, on the local preview (the live site is checked separately once it exists) ── */
const mindState = (page: Page) => page.evaluate(() => (window as unknown as { __scene: { mindState: string } }).__scene.mindState);
async function ask(page: Page, q: string) {
  await page.locator("#hero-ask").fill(q);
  await page.locator("#hero-ask").press("Enter");
}
const answerBox = (page: Page) => page.locator(".ask-answer");
const status = (page: Page) => page.locator(".ask-status");

test("hero: the first screen says what the site is and offers the question box", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("I build systems that can show their work.");
  await expect(page.locator(".hero-lead")).toContainText("verified portfolio and repository evidence");
  for (const name of ["About", "Skills", "Projects", "Contact"]) await expect(page.locator("nav[aria-label=Main] a", { hasText: new RegExp(`^${name}$`) })).toBeAttached();
  await expect(page.locator("#hero-ask")).toBeVisible();
});

test("demo flow: the mind follows the question lifecycle and every answer shows its evidence", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "state timing is asserted on desktop; mobile layout has its own test");
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.locator("#hero-ask").focus();
  await expect(status(page)).toContainText("Listening");
  expect(await mindState(page)).toBe("listening");

  await ask(page, "What did Aziz personally build in TraffiX?");
  await expect(status(page)).toContainText("Retrieving evidence");
  expect(await mindState(page)).toBe("retrieving");
  const box = answerBox(page);
  await expect(box).toContainText("Control pair");
  await expect(box.locator(".ask-evidence a").first()).toHaveAttribute("href", /traffix\/blob\/d54b071[0-9a-f]*\/README\.md#L635-L648/);
  await expect(box.locator(".ask-limits")).toContainText("did not build it alone");
  await expect(status(page)).toContainText("Answering from evidence");

  await page.waitForTimeout(700);                                   /* the throttle gap */
  await ask(page, "Did TraffiX make ambulances faster?");
  await expect(box).toContainText("The evidence disagrees");
  await expect(box).toContainText("240.0 s against 213.2 s");

  await page.waitForTimeout(700);
  await ask(page, "What is the AWS hosting status?");
  await expect(box).toContainText("Deployment is not verified");
  await expect(box).toContainText("does not prove a deployment");
  await expect(box.locator(".ask-evidence a").first()).toHaveAttribute("href", /amplify\.yml$/);

  await page.waitForTimeout(700);
  await ask(page, "Does Aziz use Bedrock?");
  await expect(box).toContainText("Not verified");
  await expect(box).not.toContainText("is recorded as connected");
  await expect(status(page)).toContainText("Not verified");
  expect(await mindState(page)).toBe("uncertain");

  await page.waitForTimeout(700);
  await ask(page, "What is your favourite colour?");
  await expect(box).toContainText("won't guess");
  await expect(box.locator(".ask-evidence a")).toHaveCount(0);
  await page.screenshot({ path: `reports/screens/${info.project.name}-hero-uncertain.png` });
  await expect(status(page)).toContainText("Idle", { timeout: 6000 });   /* the mind settles back */
});

test("the question box refuses over-long input and answers each outcome with its own label", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#hero-ask")).toHaveAttribute("maxlength", "200");
  await ask(page, "Is TraffiX deployed in Tunis?");
  await expect(answerBox(page).locator(".ask-outcome")).toContainText("the evidence disagrees");
  await page.waitForTimeout(700);
  await ask(page, "Do you know Kubernetes?");
  await expect(answerBox(page).locator(".ask-outcome")).toHaveText("Not verified");
});

test("hero keeps the whole panel inside the viewport (desktop, laptop and phone)", async ({ page }) => {
  for (const [w, h] of [[1280, 860], [1280, 720], [390, 844], [320, 640]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.waitForTimeout(600);
    await ask(page, "What did Aziz personally build in TraffiX?");
    await expect(answerBox(page)).toBeVisible();
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, input: document.querySelector("#hero-ask")!.getBoundingClientRect().bottom, vh: innerHeight, ans: document.querySelector(".ask-answer")!.getBoundingClientRect().bottom }));
    expect(m.sw, `${w}px overflow`).toBe(m.cw);
    expect(m.input, `${w}x${h}: input below the fold`).toBeLessThan(m.vh);
    expect(m.ans, `${w}x${h}: answer clipped`).toBeLessThanOrEqual(m.vh + 2);
  }
});

test.describe("reduced motion: the state is still readable as text", () => {
  test.use({ reducedMotion: "reduce" });
  test("question, status line and answer work without animation", async ({ page }) => {
    await page.goto("/");
    await ask(page, "Does Aziz use Lambda?");
    await expect(status(page)).toContainText("Retrieving evidence");
    await expect(answerBox(page)).toContainText("Not verified");
    await expect(status(page)).toContainText("Not verified");
  });
});

test("keyboard: Tab reaches the question box, samples and answer; Enter submits", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "keyboard path checked on desktop");
  await page.goto("/");
  await page.locator("#hero-ask").focus();
  await page.keyboard.type("Does Aziz use Bedrock?");
  await page.keyboard.press("Enter");
  await expect(answerBox(page)).toContainText("Not verified");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Ask", exact: true })).toBeFocused();
  const ring = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
  expect(ring).toBe("solid");
});

test("refresh and hash links land on the right section", async ({ page }) => {
  for (const id of ["about", "skills", "projects", "aws", "certifications", "contact"]) {
    await page.goto(`/#${id}`);
    await page.reload();
    await expect(page.locator(`#${id}`)).toBeVisible();
    expect(await page.evaluate((i) => Math.abs(document.getElementById(i)!.getBoundingClientRect().top) < innerHeight, id), id).toBe(true);
  }
});

test("the AWS section says not deployed and lists services as planned only", async ({ page }) => {
  await page.goto("/#aws");
  const sec = page.locator("#aws");
  await expect(sec.locator(".aws-status")).toContainText("Not deployed yet");
  await expect(sec.getByRole("heading", { name: "Planned, not connected" })).toBeVisible();
  for (const svc of ["Amazon Bedrock", "AWS Lambda", "Amazon API Gateway"]) await expect(sec).toContainText(svc);
  await expect(sec.getByRole("heading", { name: "Verified" })).toBeVisible();
  await expect(sec.locator("a[href$='amplify.yml']")).toHaveCount(1);
});

