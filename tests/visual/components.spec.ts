import { test, expect } from '@playwright/test';
import { gotoStable } from './fixtures';

/**
 * Component-level snapshots.
 *
 * This is the strategy that scales. A full-page snapshot answers "did anything
 * change?"; these answer "what changed?". Move the Button's padding and exactly
 * the Button snapshots go red — Badge and Input stay green, so the diff points
 * at the cause instead of at the whole page.
 *
 * Each screenshot targets a locator, not the page, so unrelated layout shifts
 * elsewhere on the route cannot touch these baselines.
 */

const STATES = [
  'btn-default',
  'btn-secondary',
  'btn-disabled',
  'card-default',
  'card-elevated',
  'badge-success',
  'badge-warn',
  'badge-error',
  'input-empty',
  'input-filled',
  'input-error',
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
