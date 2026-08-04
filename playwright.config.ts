import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression configuration.
 *
 * The governing idea: a screenshot baseline is a function of its rendering
 * environment. Anything that varies between two runs — OS, CPU architecture,
 * font rasterization, animation timing, data — will surface as a pixel diff.
 * Every option below removes one of those variables.
 *
 * Authoritative runs happen inside mcr.microsoft.com/playwright:v1.62.1-noble.
 * Running on the host is supported for fast iteration, but those results are
 * NOT the source of truth and the baselines will not match.
 */
export default defineConfig({
  testDir: './tests/visual',

  /*
   * Playwright's default template appends a {platform} segment, which produces a
   * separate baseline per OS. We deliberately drop it: Docker pins the platform
   * to exactly one, so a second set would be dead weight that silently rots.
   */
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // A retried visual test is a lie: flakiness is the signal we want.
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1, // A 2x DPR would silently double every baseline.
  },

  expect: {
    toHaveScreenshot: {
      /*
       * threshold      — per-pixel colour distance in the YIQ space, 0..1.
       * maxDiffPixels  — how many pixels may exceed `threshold` before failing.
       *
       * These values are measured, not guessed. The suite first ran at
       * threshold: 0, which produced a false positive: the Badge component
       * consumes no spacing token, yet an unrelated token change reddened
       * `badge-success` with 18 differing pixels at a maximum delta of 1/255 —
       * sub-perceptual rasterization noise, invisible to any human.
       *
       * threshold: 0.2 (Playwright's own default) absorbs that noise. It does
       * NOT absorb real regressions: the same token change still moved buttons
       * by 4px and the landing page by 30px, and those all failed loudly.
       *
       * maxDiffPixels stays at 0 deliberately. Once `threshold` has filtered
       * out noise, any pixel that still differs is a genuine visual change and
       * should fail. Loosening both knobs at once is how suites go blind.
       */
      threshold: 0.2,
      maxDiffPixels: 0,

      animations: 'disabled', // Freezes CSS animations and transitions.
      caret: 'hide', // A blinking text caret alone makes inputs non-deterministic.
      scale: 'css', // Capture in CSS pixels, not device pixels.
      stylePath: './tests/visual/screenshot.css',
    },
  },

  /*
   * Build + preview rather than the dev server: HMR injects a client script and
   * dev output is unminified, both of which are variables we do not need.
   */
  webServer: {
    command: 'pnpm build && pnpm preview',
    url: 'http://localhost:4173',

    /*
     * `reuseExistingServer: !process.env.CI` is Playwright's usual idiom and it
     * is a trap for a visual suite. This was not theoretical here: a preview
     * server left running from an earlier run kept serving a stale bundle, so a
     * later run compared fresh baselines against old CSS and reported 15/15
     * failures that had nothing to do with the code under test.
     *
     * A functional test reusing a warm server is a harmless speedup. A visual
     * test doing it silently compares against whatever bytes that server
     * happens to hold. Always rebuild.
     */
    reuseExistingServer: false,
    timeout: 120_000,
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
