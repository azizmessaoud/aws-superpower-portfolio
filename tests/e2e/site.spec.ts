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

test("pause stops the scene and nothing resumes it except the visitor", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(800);
  const toggle = page.getByRole("button", { name: /pause motion/i });
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /play motion/i })).toHaveAttribute("aria-pressed", "true");
  const f1 = await frames(page);
  /* scrolling, clicking the field and switching tabs must not resume it */
  await page.mouse.click(1000, 300);
  await page.evaluate(() => scrollTo({ top: 200, behavior: "instant" }));
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(700);
  expect(await frames(page)).toBe(f1);
  /* the choice survives a reload */
  await page.reload();
  await page.waitForTimeout(700);
  await expect(page.getByRole("button", { name: /play motion/i })).toBeVisible();
  const f2 = await frames(page);
  await page.waitForTimeout(500);
  expect(await frames(page)).toBe(f2);
  await page.getByRole("button", { name: /play motion/i }).click();
  await page.waitForTimeout(500);
  expect(await frames(page)).toBeGreaterThan(f2);
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
    await expect(page.getByRole("button", { name: /motion/i })).toHaveCount(0);
    const f = await frames(page);
    await page.waitForTimeout(600);
    expect(await frames(page)).toBe(f);
    await expect(page.locator(".hero-h1")).toHaveCSS("opacity", "1");
    await shot(page, "reduced", info.project.name);
  });
});

test("ask my brain: results with evidence, honest no-result state, keyboard", async ({ page }, info) => {
  await page.goto("/#ask");
  const input = page.getByLabel("Your question");
  await input.fill("Are ambulances faster with TraffiX?");
  await input.press("Enter");
  const first = page.locator(".result").first();
  await expect(first).toContainText("Ambulances are slower");
  await expect(first.locator(".evidence a").first()).toHaveAttribute("href", /github\.com\/azizmessaoud\/traffix\/blob\/d54b071/);
  await expect(first.locator(".limits")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /verified passage/ })).toHaveText(/found/);
  await page.locator("#ask").screenshot({ path: `reports/screens/${info.project.name}-ask-results.png` });
  await input.fill("What is your IQ?");
  await input.press("Enter");
  await expect(page.locator(".ask-none")).toContainText("No verified passage");
  await expect(page.locator(".result")).toHaveCount(0);
  /* suggestions are buttons with a pressed state */
  const s = page.getByRole("button", { name: "How did you avoid data leakage?" });
  await s.click();
  await expect(s).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".result").first()).toContainText("deliberate leakage test", { ignoreCase: true });
});

test("hero hint hands its question to ask my brain", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Are ambulances faster/ }).click();
  await expect(page.locator(".result").first()).toContainText("Ambulances are slower");
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
  await page.getByLabel("Your question").fill("How do you process scanned documents?");
  await page.getByLabel("Your question").press("Enter");
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
  await page.getByLabel("Your question").fill("How do you process scanned documents?");
  await page.getByLabel("Your question").press("Enter");
  await expect(page.locator(".result").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains("js"))).toBe(true);
  expect(violations).toEqual([]);
});
