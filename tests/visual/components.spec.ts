import { test, expect } from '@playwright/test';
import { gotoStable } from './fixtures';

/**
 * Component-level snapshots.
 *
 * This is the strategy that scales. A full-page snapshot answers "did anything
 * change?"; these answer "what changed?". Button consumes the `--space-4` token
 * and Badge deliberately consumes none, so changing that one token turns the
 * Button snapshots red while Badge stays green. The green half is the useful
 * half: it tells you where NOT to look.
 *
 * Each screenshot targets a locator, not the page, so unrelated layout shifts
 * elsewhere on the route cannot touch these baselines.
 */

const STATES = [
  'btn-default',
  'btn-secondary',
  'btn-disabled',
  'badge-success',
  'badge-warn',
  'badge-error',
] as const;

test.beforeEach(async ({ page }) => {
  await gotoStable(page, '/#/components');
});

for (const id of STATES) {
  test(`${id} matches baseline`, async ({ page }) => {
    await expect(page.getByTestId(id)).toHaveScreenshot(`${id}.png`);
  });
}

/**
 * Hover is a real visual state and a real source of regressions, but it cannot
 * be captured by rendering markup alone — it has to be driven.
 */
test('btn-default hover state matches baseline', async ({ page }) => {
  const button = page.getByTestId('btn-default');
  await button.hover();
  await expect(button).toHaveScreenshot('btn-hover.png');
});
