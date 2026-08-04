# Visual Regression POC: Vite + React + Playwright + pnpm

> **Historical document: kept deliberately, and no longer accurate.**
>
> This is the plan as written *before* anything was measured. It is preserved because the gap
> between it and the result is the interesting part. Two of its decisions were overturned by
> evidence:
>
> | Planned | Measured outcome |
> | --- | --- |
> | Pin `platform: linux/amd64`, assuming arm64 baselines would not port | Wrong. arm64 passes 15/15 against amd64 baselines. Pin removed, runs got 4× faster. |
> | `threshold: 0` for maximum strictness | Too strict. Produced a false positive at 1/255 colour delta. Now `threshold: 0.2`. |
>
> **See [README.md](README.md) for what was actually built and every measured number.**

## Context

A proof of concept for pixel-level visual regression testing, to be evaluated before adopting the
technique in a real project. It ships as a **public repository** and will be shared publicly, so it
has two audiences: the team evaluating feasibility, and a reader who will judge the whole thing
from the README without cloning anything.

The assertion is the easy part: Playwright ships native pixel comparison (`toHaveScreenshot()`,
backed by pixelmatch). The hard part is **render determinism**. A baseline is a function of OS,
CPU architecture, font rasterization, animation timing, and data. Baselines captured on macOS
will not match Linux CI.

So the POC pins the rendering environment to Docker and treats determinism as the deliverable.
Two outcomes matter:

1. A green suite that provably runs identically on a laptop and in CI.
2. A **deliberate failure** with a readable diff, captured as images and embedded in the README.
   A visual suite that has never failed proves nothing, and the `expected / actual / diff`
   triptych is what makes the write-up land.

### Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | Vite + React + TS | Next adds SSR/hydration variability with zero benefit. Porting the Playwright config to Next later only changes `webServer`. |
| Package manager | **pnpm** | Team preference. Forces explicit handling of the container toolchain, which is realistic. |
| Comparison tool | Playwright native | Percy/Chromatic/Applitools solve baseline hosting and team approval, not comparison. |
| Baseline environment | Docker `mcr.microsoft.com/playwright:v1.62.1-noble` | The only way baselines transfer to CI without regeneration. |
| Test surface | Component gallery + composed landing page | Exercises both snapshot strategies; shows why per-component scales better. |

### Verified environment facts

Checked at planning time, not assumed:

- `@playwright/test` latest **1.62.1**; image tag `v1.62.1-noble` confirmed present in Microsoft
  Container Registry for both amd64 and arm64.
- Node **v22.18.0**, pnpm **10.14.0**, Docker CLI **28.3.2**, gh **2.95.0**.
- Development host is **arm64** (Apple Silicon). The Docker daemon must be started before any
  authoritative run.

---

## Architecture

```
pixel-perfect-poc/
├── src/
│   ├── components/
│   │   ├── Button.tsx   Button.css     (default | hover | disabled)
│   │   ├── Card.tsx     Card.css       (default | elevated)
│   │   ├── Badge.tsx    Badge.css      (success | warn | error)
│   │   └── Input.tsx    Input.css      (empty | filled | error)
│   ├── routes/
│   │   ├── Landing.tsx                 composes components; includes masked timestamp
│   │   └── Gallery.tsx                 isolated states, one testid each
│   ├── styles/tokens.css               CSS custom properties: the regression lever
│   └── main.tsx                        hash routing, ~10 lines, no router dep
├── tests/visual/
│   ├── components.spec.ts
│   ├── landing.spec.ts
│   ├── tolerance.spec.ts
│   ├── screenshot.css                  injected at capture time
│   └── __screenshots__/                committed baselines
├── docs/                               expected/actual/diff PNGs for the README
├── playwright.config.ts
├── docker-compose.visual.yml
├── .github/workflows/visual.yml
├── package.json                        must carry "packageManager": "pnpm@10.14.0"
├── LICENSE                             MIT
└── README.md                           the actual product
```

### Determinism controls

Each neutralizes one known flakiness source:

- **Fonts**: self-host `@fontsource/inter`. Never a CDN: network timing changes which glyphs have
  painted at capture. A fixture awaits `document.fonts.ready` before every screenshot.
- **Animations/transitions**: `animations: 'disabled'`, reinforced by `screenshot.css`.
- **Caret**: `caret: 'hide'`.
- **Scrollbars**: hidden via `screenshot.css`; width differs across platforms.
- **Pixel ratio**: fixed viewport `1280x720`, `deviceScaleFactor: 1`, `scale: 'css'`.
- **Dynamic data**: Landing carries one deliberate "last updated" timestamp, masked with
  `mask: [page.getByTestId('timestamp')]`. It exists to demonstrate the escape hatch every real
  project eventually needs.
- **Build, not dev server**: `webServer` runs build + preview. The dev server's HMR client and
  unminified output are extra variables.

### `playwright.config.ts` shape

```ts
export default defineConfig({
  testDir: './tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  //                     ^ no {platform} segment: Docker guarantees a single platform
  use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 0,        // strict default; tolerance.spec.ts overrides per assertion
      threshold: 0,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      stylePath: './tests/visual/screenshot.css',
    },
  },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
```

Strict-by-default is deliberate. Starting loose hides the instability the POC exists to measure.

### Docker execution: pnpm specifics

Three constraints, each with a concrete fix:

1. **The Playwright image ships Node and npm, not pnpm.** Fix: `corepack enable` at container
   start, with `"packageManager": "pnpm@10.14.0"` in `package.json` pinning the version.
2. **Host `node_modules` cannot be bind-mounted.** Vite depends on `esbuild`/`rollup` native
   binaries built for darwin-arm64. A named volume masks the directory so install happens inside
   the container.
3. **pnpm's content-addressable store must be cached separately**, or every clean run re-downloads
   everything. It gets its own volume.

```yaml
services:
  visual:
    image: mcr.microsoft.com/playwright:v1.62.1-noble
    platform: linux/amd64          # match typical CI runners; revisit after experiment 4
    working_dir: /work
    environment:
      - CI=1
      - PNPM_HOME=/pnpm
      - PLAYWRIGHT_BROWSERS_PATH=/ms-playwright   # browsers preinstalled in image
    volumes:
      - .:/work
      - visual_node_modules:/work/node_modules
      - pnpm_store:/pnpm/store
    command: >
      sh -c "corepack enable &&
             pnpm install --frozen-lockfile &&
             pnpm exec playwright test"
volumes:
  visual_node_modules:
  pnpm_store:
```

CI uses the **same image tag** via `container:` in the workflow. That identity is what makes
baselines portable.

### pnpm scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `preview` | Vite defaults |
| `test:visual` | Playwright on the host. Fast iteration; baselines will differ, that is expected |
| `test:visual:docker` | The authoritative run |
| `test:visual:update` | Docker run with `--update-snapshots`: the **only** sanctioned way to write baselines |

---

## Implementation steps

1. **Scaffold**: `pnpm create vite . --template react-ts`. Add `"packageManager":
   "pnpm@10.14.0"`. Add dev dep `@playwright/test@1.62.1` and dep `@fontsource/inter`. Do not run
   `playwright install` on the host; the container already has browsers.
2. **Design system**: `tokens.css` with spacing/color/radius/typography custom properties. Every
   component consumes tokens only, so the deliberate regression is a one-line change.
3. **Components**: four presentational components, each with `data-testid`, states driven purely
   by props. No internal state, no effects, no dates.
4. **Routes**: `Gallery.tsx` renders every state in a labelled grid; `Landing.tsx` composes them
   into hero + feature cards + footer, including the masked timestamp.
5. **Playwright config + `screenshot.css`** as specified above.
6. **`components.spec.ts`**: `expect(locator).toHaveScreenshot()` per component per state
   (~12 baselines). Hover via `locator.hover()` then assert.
7. **`landing.spec.ts`**: `expect(page).toHaveScreenshot({ fullPage: true, mask: [...] })`.
8. **`tolerance.spec.ts`**: the same landing asserted with `{ threshold: 0.2, maxDiffPixelRatio:
   0.001 }`, commented to explain what each knob controls: `threshold` is per-pixel YIQ colour
   distance, `maxDiffPixelRatio` is the share of pixels allowed to differ. This is the reference a
   real project tunes against.
9. **Docker compose + GitHub Actions workflow** on the same image tag.
10. **Generate baselines** via `test:visual:update`, commit them.
11. **Run the deliberate regression** (verification step 3), copy the three PNGs from
    `test-results/` into `docs/`, revert the token change.
12. **README**: see below. Written last, because it reports real measured results.

### README structure (this is the product)

Ordered for a reader who will spend 40 seconds:

1. One paragraph: what this is and what it proves.
2. **The triptych**: `docs/expected.png`, `docs/actual.png`, `docs/diff.png` from the 16px→18px
   change, embedded inline, above the fold.
3. Quick start: three commands.
4. Determinism table: every flakiness source and its countermeasure.
5. **Findings**: the measured results from verification steps 4 and 5, as numbers, not claims.
6. Honest limits: baselines are binary blobs in git; at real-project scale that becomes a repo-size
   problem, and that is the point where Chromatic/Percy start earning their cost.

---

## Verification

Nothing is done until each has been executed and its real output reported.

**1. Green baseline run.** `pnpm test:visual:docker` passes with zero diffs on a clean checkout.

**2. Reproducibility.** Run again without touching anything. Still green. A suite that flakes on an
unchanged tree is worthless, and this catches font/animation leaks immediately.

**3. The deliberate failure, the actual deliverable.** In `tokens.css`:

```diff
- --space-4: 16px;
+ --space-4: 18px;
```

Re-run. Expected: affected component snapshots and the landing full-page snapshot fail, while
unrelated components (`Badge`) stay green. Capture `expected/actual/diff` into `docs/`. **Revert.**
Proves both that the suite catches small drift and that per-component snapshots localize the
blast radius.

**4. Architecture experiment: open question, not an assumption.** Generate baselines under
`platform: linux/amd64`, then run under `linux/arm64` against those same baselines.

- Passes → arm64 CI runners are safe, drop the slow amd64 emulation locally.
- Fails → architecture is confirmed as a pinning axis alongside OS; the README must say so.

Cheap to run, and it directly answers a question the real project will face. **Report the actual
result; do not predict it.**

**5. Host-vs-container delta.** Run `pnpm test:visual` on macOS against container baselines and
record the failure magnitude in pixels. This turns "you need Docker" from an assertion into a
number, and it is the single most useful thing in the README.

**6. CI parity.** Push and confirm the GitHub Actions run is green using the committed baselines,
with no `--update-snapshots`. This is the whole thesis of the POC.

---

## Prerequisites and risks

- **Docker Desktop must be running**: hard blocker.
- **amd64 emulation on Apple Silicon is slow.** Acceptable for a POC; step 4 may prove it
  unnecessary.
- **`corepack enable` inside the container** is easy to forget and fails confusingly. It lives in
  the compose `command` for exactly that reason.
- **Public repo**: no secrets, no personal data. Nothing in this stack needs credentials.
- **Baselines are binary files in git.** Fine at POC scale, named as a limitation in the README.
