import { test, expect } from '@playwright/test';
import { gotoStable } from './fixtures';

/**
 * Full-page snapshot of the composed landing route.
 *
 * This catches what component snapshots structurally cannot: spacing between
 * components, stacking order, and layout that only breaks once elements share a
 * page. The tradeoff is blast radius — one token change reddens this whole
 * snapshot and tells you nothing about where. Both strategies earn their place;
 * neither replaces the other.
 */

test('landing page matches baseline', async ({ page }) => {
  await gotoStable(page, '/#/');

  await expect(page).toHaveScreenshot('landing-full.png', {
    fullPage: true,
    /*
     * The timestamp is hardcoded here, so masking is not strictly required for
     * this POC to pass. It is present because every real project hits this the
     * moment a snapshot contains a clock, a build hash, or a user avatar — and
     * the alternative people reach for first (loosening the global threshold
     * until the noisy region stops failing) blinds the entire suite instead of
     * just that one box. `mask` paints the region a flat colour before
     * comparison, so everything around it stays strict.
     */
    mask: [page.getByTestId('timestamp')],
  });
});

test('landing hero region matches baseline', async ({ page }) => {
  await gotoStable(page, '/#/');

  // A clipped region: cheaper to review than a full page, still catches
  // cross-component spacing within the section that matters most.
  await expect(page.locator('header')).toHaveScreenshot('landing-hero.png');
});
