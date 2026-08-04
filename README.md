# pixel-perfect-poc

Pixel-level visual regression testing with **Playwright + Vite + React**, where the baselines
actually survive the trip from a laptop to CI.

The assertion is the easy part — Playwright ships native pixel comparison. The hard part is
**render determinism**: a screenshot baseline is a function of the OS, the CPU architecture, the
font rasterizer, animation timing, and your data. Get any of those wrong and you end up with a
suite that is either permanently red or quietly blind.

This repository is the experiment. Every number below was measured here, not estimated.

---

## Change one token, see exactly what moved

`--space-4: 16px → 18px`. One line, no component touched. The suite localizes the blast radius:

![Hero region diff](docs/hero-diff.png)

Red is what changed; ghosted grey is what didn't. The buttons moved. The heading and the paragraph
did not.

At the component level the report is blunter still — it reports geometry, not pixel counts:

| Baseline | Actual | Diff |
| --- | --- | --- |
| ![](docs/btn-expected.png) | ![](docs/btn-actual.png) | ![](docs/btn-diff.png) |
| `140 × 43` | `144 × 43` | 2px of padding on each side |

**7 of 10 snapshots failed. 3 passed.**

The three that passed are the `Badge` states. `Button` consumes `--space-4`; `Badge` deliberately
consumes none, which makes it the control group. **The green half is the useful half** — it tells
you where *not* to look. That contrast is the entire argument for per-component snapshots, and it
is why this repo keeps two components instead of one.

---

## Quick start

Requires Docker. Browsers come from the image; you do not install them locally.

```bash
pnpm install
pnpm test:visual:docker          # run against committed baselines
pnpm test:visual:docker:update   # rewrite baselines (the only sanctioned way)
pnpm test:visual:report          # open the HTML report with expected/actual/diff
```

Try it: change `--space-4` in `src/styles/tokens.css`, run the suite, open the report.

---

## How determinism is enforced

Every entry removes one specific source of flakiness. Remove any one and the suite starts failing
on an unchanged tree.

| Source of drift | Countermeasure |
| --- | --- |
| Font loading race | Self-hosted `@fontsource/inter`, never a CDN, plus a `document.fonts.ready` await before every capture (`tests/visual/fixtures.ts`) |
| Animations & transitions | `animations: 'disabled'` plus a belt-and-braces `screenshot.css` injected only at capture time |
| Text caret blink | `caret: 'hide'` and `caret-color: transparent` |
| Scrollbar width | Hidden in `screenshot.css` — it differs across platforms and steals layout space |
| Device pixel ratio | Fixed `1280×720` viewport, `deviceScaleFactor: 1`, `scale: 'css'` |
| Dynamic content | The landing page carries a timestamp, masked via `mask: [...]` — the escape hatch every real project needs |
| Dev-server variance | Tests run against `build` + `preview`, never the dev server with its HMR client |
| **Stale server** | `reuseExistingServer: false` — see Findings, this one bit us |
| **Host OS** | Everything runs in `mcr.microsoft.com/playwright:v1.62.1-noble`, and CI uses the same image tag |

The UI cooperates by construction: components are pure props-in-markup-out, with no state, no
effects, no dates, no randomness, and every visual value resolving through a token in
`src/styles/tokens.css`. That token file has zero unreferenced entries — which is what makes a
one-line change a meaningful experiment.

---

## Findings

### 1. The OS is the pinning axis. The CPU architecture is not.

This was the open question the repo existed to answer, and the intuitive guess was wrong.

Running the suite **natively on macOS** against baselines generated in the Linux container, with
byte-identical source:

| Snapshot | Baseline (Linux) | macOS |
| --- | --- | --- |
| `btn-default` | `140 × 43` | `139 × 43` — 1px narrower |
| `landing-full` | — | 21,144 differing pixels |
| `landing-hero` | — | 8,941 differing pixels |
| **Total** | | **10 of 10 failed** |

Running the same baselines under **`linux/amd64` instead of the native `linux/arm64`** — which is
exactly what CI does:

> **10 of 10 passed.**

So the amd64 pin this project started with was unnecessary. Removing it dropped QEMU emulation and
took a run from **12.7s to 3.4s**. `docker-compose.amd64.yml` remains if you ever need to reproduce
a CI runner bit for bit.

**Why this matters.** Look at `btn-default` at 140×43:

- The deliberate 2px regression makes it **144px** wide.
- Simply running on macOS makes it **139px** wide.

Both are geometry changes to the same element, in the same ballpark, and nothing in the output
distinguishes them. Generate baselines on your laptop and run CI on Linux and you cannot tell a
real bug from an operating system. That is the entire argument for containerising this, expressed
as a number rather than an opinion.

### 2. Do not run at `threshold: 0` — even when it looks safe

On the current surface, `threshold: 0` and `threshold: 0.2` produce **identical** results: 7 failed,
3 passed. So strictness costs nothing here, and you could be forgiven for setting it to zero.

Don't. On an earlier, larger version of this page, `threshold: 0` produced a **false positive**:
`Badge` — which consumes no spacing token and should have been immune — went red with 18 differing
pixels at a maximum delta of **1/255**. Sub-perceptual rasterization noise, invisible to a human,
and enough to fail a build.

That noise appeared and then stopped reproducing when the layout changed. **It is a property of
where elements happen to sit, not of your code.** A suite that is green only because of the current
layout will betray you on an unrelated refactor.

```ts
threshold: 0.2,      // per-pixel YIQ colour distance — absorbs raster noise
maxDiffPixels: 0,    // ...but zero tolerance for pixels that clear that bar
```

`0.2` is Playwright's own default and hides nothing real: every geometry shift in the regression
still failed loudly. Loosening *both* knobs at once is how suites go blind.

### 3. `reuseExistingServer` is a trap for visual tests

`reuseExistingServer: !process.env.CI` is the standard Playwright idiom and it produced a phantom
failure here. A `vite preview` left running from an earlier run kept serving a stale bundle, so a
later run compared fresh baselines against old CSS and reported 10/10 failures that had nothing to
do with the code under test. The first macOS measurement above was contaminated by exactly this and
had to be thrown out and redone.

For a functional test, reusing a warm server is a harmless speedup. For a visual test it silently
compares against whatever bytes that server happens to be holding. The config now always rebuilds.

The tell: a delta that suspiciously equals a change you made earlier.

### 4. Mask before you loosen tolerance

The landing page carries a timestamp. It is handled with `mask`, not with a raised threshold, and
the ordering is deliberate: tolerance is **global to an assertion**, so raising it to survive one
noisy region blinds every other pixel in the same screenshot. Masking is surgical.

### 5. Two snapshot strategies, and neither replaces the other

| Strategy | Catches | Costs |
| --- | --- | --- |
| Per-component (7 baselines) | Which specific component drifted | More files to review |
| Full-page (3 baselines) | Spacing *between* components, stacking, layout | One change reddens everything |

The regression showed it precisely: three component snapshots stayed green and told you where not
to look, while the full-page snapshot confirmed the cumulative effect.

---

## Layout

```
src/styles/tokens.css     every visual value; the regression lever
src/components/           Button (consumes --space-4) and Badge (the control group)
src/routes/Gallery        6 isolated states, one data-testid each
src/routes/Landing        the same components, composed
tests/visual/
  components.spec.ts        per-component, per-state, plus a driven hover state
  landing.spec.ts           full page with a masked timestamp + a clipped region
  tolerance.spec.ts         documents what threshold and maxDiffPixelRatio do
  screenshot.css            injected at capture time only
  __screenshots__/          the 10 committed baselines
docker-compose.visual.yml       the authoritative environment
docker-compose.amd64.yml        opt-in override to force amd64
.github/workflows/visual.yml    same image tag — that identity is the whole thesis
```

---

## Honest limits

- **Baselines are binary blobs in git.** Fine at 10 snapshots. At a few hundred, across several
  viewports and themes, repository size becomes a real problem — and that is where hosted services
  (Chromatic, Percy) start earning their cost. They solve baseline storage and team approval
  workflow, not comparison; Playwright already does the comparison well.
- **One browser, one viewport.** Adding Firefox, WebKit, or a mobile viewport multiplies the
  baseline count by the number of combinations, not adds to it.
- **This is a POC.** It proves the mechanism and quantifies the constraints. It does not address
  review workflow, which is what actually decides whether a visual suite survives contact with a
  team.

## License

MIT
