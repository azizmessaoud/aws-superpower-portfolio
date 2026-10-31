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

test("terminal explorer: evidence with links, honest no-result, suggestions", async ({ page }, info) => {
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

test("the brain docks into the nav's Terminal Explorer link; it is a keyboard-reachable hint", async ({ page }, info) => {
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
  await expect(page.getByRole("heading", { level: 1 })).toContainText("I build practical AI systems.");
  await expect(page.locator(".hero-lead")).toContainText("including what didn't work");
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
  await expect(box).toContainText("deployment recorded");
  await expect(box).toContainText("amplifyapp.com");
  await expect(box).toContainText("console build record is not captured yet");
  await expect(box.locator('.ask-evidence a[href$="amplify.yml"], .ask-evidence a[href*="/amplify.yml"]').first()).toBeVisible();

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

test("the AWS section records the Amplify deployment and lists the other services as planned only", async ({ page }) => {
  await page.goto("/#aws");
  const sec = page.locator("#aws");
  const status = sec.locator(".aws-status");
  await expect(status).toContainText("Hosted with AWS Amplify Hosting");
  await expect(status).toContainText("Endpoint checked");
  await expect(status).toContainText("console build record: not captured yet"); /* a reachable address is not a console record */
  await expect(status).not.toContainText("Not deployed yet");
  await expect(sec.locator(".aws-status a")).toHaveAttribute("href", /amplifyapp\.com/);
  await expect(sec.getByRole("heading", { name: "Planned, not connected" })).toBeVisible();
  for (const svc of ["Amazon Bedrock", "AWS Lambda", "Amazon API Gateway"]) await expect(sec).toContainText(svc);
  await expect(sec.getByRole("heading", { name: "Verified" })).toBeVisible();
  await expect(sec.locator("a[href$='amplify.yml']")).toHaveCount(1);
});

test("interacting with the animation never highlights the hero text, but the question box stays selectable", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "mouse interaction");
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.locator(".hero-h1").dblclick();
  await page.mouse.move(100, 300); await page.mouse.down(); await page.mouse.move(600, 420, { steps: 8 }); await page.mouse.up();
  expect(await page.evaluate(() => String(getSelection()))).toBe("");
  await page.locator("#hero-ask").fill("hello brain");
  await page.locator("#hero-ask").selectText();
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement).selectionEnd! - (document.activeElement as HTMLInputElement).selectionStart!)).toBe(11);
});

test("the question box understands typos and a recruiter's questions", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "answers are the same on mobile; layout has its own test");
  await page.goto("/");
  const box = page.locator(".ask-answer");
  const cases: [string, RegExp, RegExp?][] = [
    ["whois aziz", /ESPRIT/, /No start or end dates/],
    ["wat did aziz buld in trafix", /Control pair/],
    ["Where did he do internships?", /Sopra HR Software/, /FlyRank dates are not shown/],
    ["Which languages does he speak?", /Arabic, French and English/],
    ["Why should we hire you?", /cannot prove|not facts/, /yours to form/],
  ];
  for (const [q, text, limit] of cases) {
    await ask(page, q);
    await expect(box, q).toContainText(text);
    if (limit) await expect(box, q).toContainText(limit);
    await page.waitForTimeout(700);
  }
});


/* ── first screen, selected work, answer → project, states, failure modes ── */
test("hero: name, direction, PFE availability and two distinct actions are on the first screen", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator("#top");
  await expect(hero.locator(".hero-avail")).toContainText("2027 final-year internship (PFE)");
  await expect(hero.getByRole("link", { name: "See selected work" })).toHaveAttribute("href", "#selected");
  await expect(hero.getByRole("link", { name: "Contact Aziz" })).toHaveAttribute("href", "#contact");
  await expect(page.locator("#selected")).toBeAttached();
});

test("selected work: three flagships, each with a result, a caveat and a working link to its case study", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("#selected .selected-card");
  await expect(cards).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const c = cards.nth(i);
    await expect(c.locator(".selected-result")).not.toBeEmpty();
    await expect(c.locator(".selected-caveat")).toContainText("Caveat:");
    const href = await c.getByRole("link", { name: "Read the case study" }).getAttribute("href");
    expect(href).toMatch(/^#project-(traffix|flyrank|hr)$/);
    await expect(page.locator(href!)).toBeAttached();
  }
  /* ownership is stated only where the evidence records it: TraffiX */
  await expect(page.locator("#selected .selected-part")).toHaveCount(1);
  await expect(cards.first()).toContainText("The Control pair");
  await expect(cards.nth(1)).toContainText("observational");
  await expect(cards.nth(2)).toContainText("synthetic");
});

test("each case study opens with result, caveat and boundary before the long text", async ({ page }) => {
  await page.goto("/#projects");
  for (const id of ["traffix", "flyrank", "hr"]) {
    const g = page.locator(`#project-${id} .glance`);
    await expect(g).toContainText("Result");
    await expect(g).toContainText("Caveat");
    await expect(g).toContainText("Boundary");
  }
  await expect(page.locator("#project-traffix .glance")).toContainText("My part");
  await expect(page.locator("#project-flyrank .glance")).not.toContainText("My part");
});

test("an answer links to its case study; an answer about AWS does not pretend to be a project", async ({ page }) => {
  await page.goto("/");
  await ask(page, "What did Aziz personally build in TraffiX?");
  const open = answerBox(page).getByRole("link", { name: /Open the TraffiX case study/ });
  await expect(open).toHaveAttribute("href", "#project-traffix");
  await open.click();
  await expect(page.locator("#project-traffix")).toBeInViewport();
  await page.goto("/");
  await page.waitForTimeout(700);
  await ask(page, "What is the AWS hosting status?");
  await expect(answerBox(page)).toContainText("Endpoint checked");
  await expect(answerBox(page).getByRole("link", { name: /case study/ })).toHaveCount(0);
});

test("the four result states are labelled in words, and an empty question gets a message, not silence", async ({ page }) => {
  await page.goto("/");
  await ask(page, "What did Aziz personally build in TraffiX?");
  await expect(answerBox(page).locator(".ask-outcome")).toHaveText("Answer");
  await page.waitForTimeout(700);
  await ask(page, "Is TraffiX deployed in Tunis?");
  await expect(answerBox(page).locator(".ask-outcome")).toContainText("the evidence disagrees");
  await page.waitForTimeout(700);
  await ask(page, "Do you know Kubernetes?");
  await expect(answerBox(page).locator(".ask-outcome")).toHaveText("Not verified");
  await page.waitForTimeout(700);
  await page.locator("#hero-ask").fill("");
  await page.locator(".ask-submit").click();
  await expect(answerBox(page).locator(".ask-outcome")).toHaveText("Could not answer");
  await expect(answerBox(page)).toContainText("Type a question first");
  await expect(page.locator(".ask-status")).not.toBeEmpty();
});

test("failure mode: if the animation chunk never loads, the page and the question box still work", async ({ page }) => {
  await page.route("**/assets/NeuralScene-*.js", (r) => r.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("practical AI systems");
  await expect(page.locator("#selected .selected-card")).toHaveCount(3);
  await ask(page, "Did TraffiX make ambulances faster?");
  await expect(answerBox(page)).toContainText("240.0 s");
  /* the failed import is expected here, and nothing else may have gone wrong; the global guard then sees a clean list */
  const list = errors.get(page)!;
  expect(list.some((m) => /NeuralScene/.test(m))).toBe(true);
  errors.set(page, list.filter((m) => !/NeuralScene|dynamically imported module|Failed to load resource|ERR_FAILED/.test(m)));
});

test("failure mode: without JavaScript the visitor is told where the evidence is", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:4173/");
  const text = (await page.locator("noscript").first().textContent()) ?? "";
  expect(text).toContain("2027 final-year internship (PFE)");
  expect(text).toContain("aziz.messaoud@esprit.tn");
  for (const repo of ["traffix", "flyrank", "hr-anomaly-detection"]) await expect(page.locator(`noscript a[href="https://github.com/azizmessaoud/${repo}"]`)).toHaveCount(1);
  await ctx.close();
});

test("the name stays on the first screen even on a short laptop window; only the secondary line yields", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.goto("/");
  await page.waitForTimeout(600);
  await expect(page.locator(".eyebrow-name")).toBeVisible();
  await expect(page.locator(".eyebrow-name")).toHaveText("Aziz Messaoud");
  await expect(page.locator(".eyebrow-role")).toBeHidden();
});

test("sample questions are at least 44 px tall on phones, so they are easy to tap", async ({ page }) => {
  for (const [w, h] of [[390, 844], [320, 640]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/");
    await page.waitForTimeout(500);
    const chips = page.locator(".ask-samples .suggest-q:visible");
    const n = await chips.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) expect((await chips.nth(i).boundingBox())!.height, `${w}px chip ${i}`).toBeGreaterThanOrEqual(43.5);
  }
});

/* ── UI pass: aligned cards, shared measure, calm menu, nav states ── */
test("Selected work: kicker, title, result, caveat and links line up across the three cards on desktop", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "side-by-side layout is for wide screens");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#selected");
  await page.waitForTimeout(700);
  for (const cls of ["selected-kind", "selected-title", "selected-result", "selected-caveat", "selected-links"]) {
    const tops = await page.locator(`#selected .${cls}`).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops, cls).toHaveLength(3);
    expect(Math.max(...tops) - Math.min(...tops), `${cls} tops ${tops}`).toBeLessThanOrEqual(1);
  }
  const over = await page.locator("#selected .selected-card").evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  expect(over).toBe(0);
});

test("Selected work: the main action is a button-weight link of at least 44 px, the proof link is secondary", async ({ page }) => {
  await page.goto("/#selected");
  const open = page.locator("#selected .selected-open").first(), proof = page.locator("#selected .selected-proof").first();
  expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
  expect(await open.evaluate((e) => getComputedStyle(e).borderTopWidth)).not.toBe("0px");
  expect(await proof.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeLessThan(await open.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)));
});

test("case studies use one measure on desktop: the Result block, the figures and the label share the column", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "wide-screen layout");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/#projects");
  for (const id of ["traffix", "flyrank", "hr"]) {
    const m = await page.evaluate((i) => {
      const c = document.querySelector(`#project-${i}`)!, g = c.querySelector(".glance")!.getBoundingClientRect(), l = c.querySelector(".plabel")!.getBoundingClientRect(), a = c.getBoundingClientRect();
      return { glance: g.width, label: l.width, col: a.width, gr: g.right, lr: l.right };
    }, id);
    expect(m.glance / m.col, `${id}: glance fills the column`).toBeGreaterThan(0.95);
    expect(Math.abs(m.gr - m.lr), `${id}: glance and label share a right edge`).toBeLessThanOrEqual(2);
  }
});

test("mobile menu: opaque and blurred, so headline text does not ghost through; items are 44 px tall", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "menu exists below 760px");
  await page.goto("/");
  await page.locator(".nav-toggle").click();
  await page.waitForTimeout(500);
  const s = await page.locator(".nav-links").evaluate((e) => { const c = getComputedStyle(e); return { bg: c.backgroundColor, blur: c.backdropFilter || (c as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter }; });
  expect(Number(s.bg.match(/[\d.]+(?=\)$)/)?.[0])).toBeGreaterThanOrEqual(0.98);
  expect(s.blur).toContain("blur");
  const hs = await page.locator(".nav-links a").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of hs) expect(h).toBeGreaterThanOrEqual(43.5);
});

test("nav: the active section follows the page, and keyboard focus shows a visible ring", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "desktop nav");
  await page.goto("/");
  await page.waitForTimeout(600);
  await page.evaluate(() => document.getElementById("projects")!.scrollIntoView({ behavior: "instant" as ScrollBehavior }));
  await page.waitForTimeout(700);
  await expect(page.locator('.nav-links a[aria-current="true"]')).toHaveText("Projects");
  await page.locator(".nav-links a", { hasText: "Skills" }).focus();
  const ring = await page.locator(".nav-links a", { hasText: "Skills" }).evaluate((e) => { const c = getComputedStyle(e); return { style: c.outlineStyle, width: parseFloat(c.outlineWidth) }; });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThanOrEqual(2);
});

test("results table on a 320 px phone: each row stacks, numbers stay with their units, columns line up, table roles are kept", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/#projects");
  await page.waitForTimeout(500);
  const t = page.locator("table.results");
  await expect(t).toHaveAttribute("role", "table");
  await expect(t.locator("tbody td[data-label]").first()).toHaveAttribute("data-label", "TraffiX");
  expect(await t.evaluate((e) => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  /* a value and its unit never split across lines */
  const split = await t.locator("tbody td").evaluateAll((els) => els.slice(0, -1).filter((e) => { const r = document.createRange(); r.selectNodeContents(e); return e.textContent!.includes(" s") && r.getClientRects().length > 2; }).length);
  expect(split).toBe(0);
  /* the three columns start at the same x in every row */
  for (const k of [0, 1, 2]) {
    const xs = await t.locator("tbody tr").evaluateAll((rows, i) => rows.map((r) => Math.round(r.querySelectorAll("td")[i]!.getBoundingClientRect().left)), k);
    expect(Math.max(...xs) - Math.min(...xs), `column ${k} x positions ${xs}`).toBeLessThanOrEqual(1);
  }
  await expect(t.locator("caption")).toBeVisible();
  expect((await t.locator("caption").boundingBox())!.width).toBeGreaterThan(250);
});
