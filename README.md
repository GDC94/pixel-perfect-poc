# pixel-perfect-poc

Visual regression testing with **Playwright + Vite + React**, with baselines that survive the trip
from a laptop to CI.

Change one design token, and the suite tells you exactly which components moved — and which didn't.

![Hero region diff](docs/hero-diff.png)

*Red changed. Ghosted grey didn't. The buttons moved; the heading and paragraph did not.*

---

## What this is — and what it is not

**This is a lock, not a design review.**

The baseline is a photo of *what you built*, taken by you. Nothing here knows what your Figma says.
So the order matters:

```
1. You build the component
2. YOU compare it against the Figma — by eye        ← design fidelity is checked here
3. Only then do you record the baseline             ← this freezes it
```

If you record before checking, you have locked in the bug and the suite will defend it forever.

| | |
| --- | --- |
| ✅ **What it answers** | "Did my change move something I didn't intend to move?" |
| ❌ **What it does NOT answer** | "Does this match the Figma?" |
| ❌ **Nor** | "Does it look the same on Mac, Linux and Windows?" (measured here: it does **not** — see Findings) |

If you need automated comparison **against Figma**, that is a different category of tool — see
[Comparing against Figma](#comparing-against-figma) below.

---

## Try it in 4 steps

Requires Docker running. Browsers come from the image — you do not install them locally.

**1. Install and check it's green**

```bash
pnpm install
pnpm test:visual:docker
```

```
  VISUAL SUITE PASSED   10/10 snapshots match their baselines
```

**2. Break something on purpose**

In `src/styles/tokens.css`, change one line. Touch no component:

```diff
- --space-4: 16px;
+ --space-4: 18px;
```

**3. Run again**

```bash
pnpm test:visual:docker
```

```
  VISUAL DIFFERENCES FOUND   7 changed · 3 unchanged

  CHANGED
    btn-default          140×43 → 144×43    shape changed
    btn-disabled         140×43 → 144×43    shape changed
    btn-hover            140×43 → 144×43    shape changed
    btn-secondary        157×43 → 161×43    shape changed
    landing-full      1280×1518 → 1280×1522 shape changed
    landing-hero          1,227 px  1.0% of the image
    landing-tolerant  1280×1518 → 1280×1522 shape changed

  UNCHANGED  — these tell you where not to look
    badge-error, badge-success, badge-warn
```

**Badge stays green.** It consumes no spacing token, so it is the control group. That contrast —
not the red — is the point: the suite tells you *where the change landed*.

**4. Look at the diffs, then undo**

```bash
pnpm test:visual:report        # expected / actual / diff, side by side
git checkout src/styles/tokens.css
```

---

## Why Docker

A screenshot is not "how your component looks". It is **how your component looks rendered by that
browser, on that OS, with that font engine.**

Measured here: the same code, same baselines, run natively on macOS instead of in the Linux
container → **10 of 10 failed**. A button went from 140px to 139px wide.

So Docker is not infrastructure — it is a **calibrated measuring instrument**. You pick one
environment, record there, and always compare there. CI uses the same image tag, which is the
only reason a baseline recorded on your laptop means anything on a runner.

**The one rule:** record baselines inside the container. Always.

```bash
pnpm test:visual:docker:update   # ✅
pnpm test:visual:update          # ❌ uses your host OS
```

---

## Findings

All measured in this repo, not estimated.

| Question | Answer |
| --- | --- |
| Do baselines survive a different **OS**? | **No.** macOS vs Linux container: 10/10 failed. `btn-default` 140×43 → 139×43. |
| Do they survive a different **CPU architecture**? | **Yes.** arm64 vs amd64: 10/10 passed. Dropping the amd64 pin took a run from 12.7s → 3.4s. |
| Is `threshold: 0` safe? | **No.** On an earlier layout it produced a false positive at **1/255** colour delta — sub-perceptual noise, red build. The noise is layout-dependent, so it can appear on an unrelated refactor. Settled on `threshold: 0.2, maxDiffPixels: 0`. |
| Is `reuseExistingServer` safe? | **No.** A stale `vite preview` served an old bundle and produced a phantom 10/10 failure. Now always rebuilds. |

**The number that justifies the whole setup.** On the same element, baseline 140px wide:

- The deliberate 2px regression → **144px**
- Merely running on macOS → **139px**

Two geometry changes of similar size, indistinguishable in the output. Record baselines on your
laptop and run CI on Linux, and you cannot tell a real bug from an operating system.

---

## How determinism is enforced

Remove any one of these and the suite starts failing on unchanged code.

| Source of drift | Countermeasure |
| --- | --- |
| Font loading race | Self-hosted `@fontsource/inter`, plus a `document.fonts.ready` await before every capture |
| Animations & transitions | `animations: 'disabled'` plus `screenshot.css`, injected only at capture time |
| Caret, scrollbars | `caret: 'hide'`; scrollbar width hidden (it differs across platforms) |
| Pixel ratio | Fixed `1280×720`, `deviceScaleFactor: 1`, `scale: 'css'` |
| Dynamic content | The footer timestamp is `mask`ed — mask *before* you loosen tolerance, since tolerance is global to an assertion |
| Dev-server variance | Runs against `build` + `preview`, never the dev server |
| Host OS | Everything in `mcr.microsoft.com/playwright:v1.62.1-noble`; CI uses the same tag |

The UI cooperates by construction: pure props-in-markup-out components, no state, no effects, no
dates, no randomness, and every visual value resolving through a token in `src/styles/tokens.css`
(which has zero unreferenced entries).

---

## Comparing against Figma

This repo does **not** do that, and neither does any pixel-diff tool — for a hard technical reason:
**Figma is not a browser.** It has its own rendering engine, with different kerning, hinting and
antialiasing. Even with the identical font, the letters do not land on the same pixels. A strict
diff against a Figma export always fails, and the tolerance needed to make it pass blinds the test.

If you need automated design-vs-code checking, these exist and take a different approach — they
compare **properties** or use perceptual AI, not raw pixels:

| Tool | Approach |
| --- | --- |
| [Applitools](https://applitools.com/solutions/figma/) | Figma plugin, Visual AI design-to-code comparison |
| [Uiprobe](https://www.uiprobe.io/learn/perfectpixel-alternatives-figma-design-qa) | Automated **property-level** comparison (spacing, colour, type) |
| [Pixelay](https://www.hypermatic.com/pixelay/) | Figma-over-live-site overlay, 7 comparison modes |
| PerfectPixel, Over.fig | Manual browser overlay |

**The cheapest fix is structural, though.** If your Figma Variables are exported into
`tokens.css` (via the Figma API or Style Dictionary), the values *are the same data* — there is
nothing left to compare. Do that first; it beats any comparison tool and costs nothing.

---

## Layout

```
src/styles/tokens.css   every visual value; the regression lever
src/components/         Button (consumes --space-4) · Badge (the control group)
src/routes/             Gallery (6 isolated states) · Landing (composed page)
tests/visual/
  components.spec.ts      per-component, per-state, plus a driven hover
  landing.spec.ts         full page with a masked timestamp + a clipped region
  tolerance.spec.ts       what threshold and maxDiffPixelRatio actually do
  reporter.ts             console output built for reading diffs
  __screenshots__/        the 10 committed baselines
docker-compose.visual.yml     the authoritative environment
.github/workflows/visual.yml  same image tag — that identity is the whole thesis
```

---

## Limits

- **Baselines are binary blobs in git.** Fine at 10. At a few hundred across viewports and themes,
  repo size becomes real — that is where Chromatic/Percy start earning their cost.
- **One browser, one viewport.** Adding more multiplies baselines, it does not add to them.
- **Snapshot only what is stable and load-bearing.** Anything with live data, dates or relative
  timestamps will be red every day, and a suite people ignore is worse than none.

## License

MIT
