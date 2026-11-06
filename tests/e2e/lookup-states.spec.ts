import { expect, test, type Page } from "@playwright/test";

/* The lookup states, driven by the test-only fault injector (src/dev/sabotage.ts). The injector exists only in the "e2e" build,
 * served on port 4175; the public build compiles it away, which the last test proves. */
test.use({ baseURL: "http://127.0.0.1:4175" });

const Q = "What is FlyRank?";
async function open(page: Page, fault: string, extra = "") {
  await page.goto(`/?sabotage=${fault}${extra}`);
  await page.waitForTimeout(1200);
}
async function ask(page: Page, q = Q) {
  await page.locator("#hero-ask").fill(q);
  await page.locator("#hero-ask").press("Enter");
}
const card = (page: Page) => page.locator(".ask-answer");

test("while the lookup runs, a skeleton stands in for the answer, and it is gone once the answer arrives", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1200);
  await ask(page);
  await expect(page.locator(".ask-skeleton")).toBeVisible();
  await expect(page.locator(".ask-status")).toContainText("Retrieving evidence");
  await expect(card(page).locator(".ask-outcome")).toHaveText("Answer");
  await expect(page.locator(".ask-skeleton")).toHaveCount(0);
});

test("a lookup that throws shows a failure card apart from 'Not verified', and keeps the question", async ({ page }) => {
  await open(page, "throw");
  await ask(page);
  await expect(card(page)).toContainText("Could not look that up");
  await expect(card(page).locator(".ask-outcome")).toContainText("not about the evidence");
  await expect(card(page).locator(".ask-kept")).toHaveText(Q);
  await expect(page.locator(".ask-status")).toContainText("Could not process that question");
  await expect(page.getByRole("button", { name: /Retry this question/ })).toBeVisible();
  await expect(page.locator("#hero-ask")).toHaveValue(Q);
});

test("retry repeats the question exactly once and lands on the answer, with focus on it", async ({ page }) => {
  await open(page, "flaky");
  await ask(page);
  await expect(card(page)).toContainText("Could not look that up");
  await page.getByRole("button", { name: /Retry this question/ }).click();
  await expect(card(page).locator(".ask-outcome")).toHaveText("Answer");
  expect(await page.evaluate(() => (globalThis as { __lookups?: number }).__lookups)).toBe(2);
  await expect(card(page)).toBeFocused();
});

test("an answer with its source stripped is refused, never shown", async ({ page }) => {
  await open(page, "nosource");
  await ask(page);
  await expect(card(page)).toContainText("cannot trust");
  await expect(card(page).locator(".ask-outcome")).not.toHaveText("Answer");
});

test("malformed data is refused too", async ({ page }) => {
  await open(page, "malformed");
  await ask(page);
  await expect(card(page)).toContainText("cannot trust");
});

test("a slow lookup says so and offers Cancel; cancelling keeps the question in the box", async ({ page }) => {
  /* "hang" with a long timeout gives a stable window: the "slow" fault answers 1 s after Cancel appears, which a loaded machine can miss. */
  await open(page, "hang", "&timeout=30000");
  await ask(page);
  await expect(page.locator(".ask-skeleton")).toBeVisible();
  const cancel = page.locator(".ask-skeleton").getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeVisible({ timeout: 6000 });
  await cancel.click();
  await expect(page.locator(".ask-skeleton")).toHaveCount(0);
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator("#hero-ask")).toHaveValue(Q);
  await expect(page.locator(".ask-status")).toContainText("Idle");
});

test("Escape cancels a lookup in flight", async ({ page }) => {
  await open(page, "hang", "&timeout=8000");
  await ask(page);
  await expect(page.locator(".ask-skeleton")).toBeVisible();
  await page.locator("#hero-ask").press("Escape");
  await expect(page.locator(".ask-skeleton")).toHaveCount(0);
  await expect(page.locator("#hero-ask")).toHaveValue(Q);
});

test("a lookup that never answers ends as a timeout, not as endless loading", async ({ page }) => {
  await open(page, "hang", "&timeout=1500");
  await ask(page);
  await expect(card(page).locator(".ask-outcome")).toContainText("timed out", { timeout: 6000 });
  await expect(page.locator(".ask-skeleton")).toHaveCount(0);
});

test("the public build has no fault injector: the same URL changes nothing", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/?sabotage=throw");
  await page.waitForTimeout(1200);
  await ask(page);
  await expect(card(page).locator(".ask-outcome")).toHaveText("Answer");
});
