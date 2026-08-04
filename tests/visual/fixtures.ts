import type { Page } from '@playwright/test';

/**
 * Navigate, then block until the page is genuinely settled.
 *
 * `page.goto` resolves on the load event, which is earlier than "the pixels are
 * final". Web fonts are the usual culprit: the browser paints a fallback face,
 * then reflows once Inter arrives. A screenshot taken between those two moments
 * is neither of the two correct answers — it is a third, random one. This is the
 * most common cause of "passes locally, fails in CI" in a visual suite.
 */
export async function gotoStable(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
  // Yield one frame so any font-triggered reflow has been painted.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve(null))),
  );
}
