import { test, expect } from '@playwright/test';
import { gotoStable } from './fixtures';

/**
 * Reference for the two tolerance knobs. This file exists to be read, not just
 * to run. A real project tunes these, and tuning them blind is how visual
 * suites end up either permanently red or quietly blind.
 *
 * The global config is strict (`threshold: 0, maxDiffPixels: 0`). These
 * assertions override it per call to document what each option actually does.
 *
 * A hard-won note on ordering: reach for `mask` BEFORE reaching for tolerance.
 * Tolerance is global to an assertion, so raising it to survive one noisy
 * region also blinds every other pixel in the same screenshot. Masking is
 * surgical; tolerance is a blunt instrument.
 */

test.beforeEach(async ({ page }) => {
  await gotoStable(page, '/#/');
});

test('landing tolerates sub-perceptual colour drift', async ({ page }) => {
  await expect(page).toHaveScreenshot('landing-tolerant.png', {
    fullPage: true,
    mask: [page.getByTestId('timestamp')],

    /*
     * threshold: per-pixel acceptable colour distance in the YIQ colour space,
     * 0..1. It does NOT mean "0.2 of the image may differ": it is applied to
     * each pixel independently, and a pixel closer than this to its baseline
     * counterpart is simply not counted as different at all.
     *
     * 0.2 is Playwright's own default and absorbs anti-aliasing noise. It will
     * NOT absorb a layout shift: a moved edge produces pixels that are entirely
     * the wrong colour, well past any sane threshold.
     */
    threshold: 0.2,

    /*
     * maxDiffPixelRatio: of the pixels that DID exceed `threshold`, what share
     * of the total image may they represent before the test fails.
     *
     * 0.001 on a 1280-wide full-page shot is roughly a thousand pixels, enough
     * to ride out a font-hinting difference, not nearly enough to hide a 2px
     * padding change, which reflows everything below it.
     *
     * The absolute-count sibling is `maxDiffPixels`. Prefer the ratio for
     * full-page shots (their height varies with content) and the absolute count
     * for fixed-size component shots.
     */
    maxDiffPixelRatio: 0.001,
  });
});
