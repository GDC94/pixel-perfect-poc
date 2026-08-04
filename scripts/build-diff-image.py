#!/usr/bin/env python3
"""
Rebuild the README's baseline/actual/diff image from a real failing run.

The README's opening image is not a mockup — it is generated from actual
Playwright artifacts, so it cannot drift away from what the suite really does.

    # 1. cause the documented regression
    sed -i '' 's/--space-4: 16px;/--space-4: 18px;/' src/styles/tokens.css
    pnpm test:visual:docker          # fails, writing test-results/
    # 2. rebuild the image, then put the token back
    python3 scripts/build-diff-image.py
    sed -i '' 's/--space-4: 18px;/--space-4: 16px;/' src/styles/tokens.css

Why a crop: the hero snapshot is 1056x477 and the change occupies about 1.9%
of it. Shown whole at README width the signal is invisible and the image reads
as broken. The crop below is centred on the measured bounding box of changed
pixels.

Requires Pillow (`pip install pillow`). Docs-only — never runs in CI.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path('test-results/landing-landing-hero-region-matches-baseline-chromium')
OUT = Path('docs/diff-triptych.png')

CROP = (0, 372, 300, 442)  # the button band within the hero snapshot
ZOOM = 2
LABEL_H, GAP, PAD = 30, 14, 22

BG, INK, MUTED, BORDER = (246, 246, 243), (23, 23, 27), (110, 110, 118), (219, 219, 214)

PANELS = [
    ('landing-hero-expected.png', 'BASELINE', '--space-4: 16px'),
    ('landing-hero-actual.png', 'ACTUAL', '--space-4: 18px'),
    ('landing-hero-diff.png', 'DIFF', 'red = every changed pixel'),
]


def font(size: int, bold: bool = False):
    try:
        return ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', size, index=1 if bold else 0)
    except OSError:
        return ImageFont.load_default()


def main() -> None:
    missing = [n for n, _, _ in PANELS if not (SOURCE / n).exists()]
    if missing:
        raise SystemExit(
            f'Missing artifacts in {SOURCE}: {", ".join(missing)}\n'
            'Run the documented regression first so Playwright writes them.'
        )

    panel_w = (CROP[2] - CROP[0]) * ZOOM
    panel_h = (CROP[3] - CROP[1]) * ZOOM
    f_label, f_sub = font(15, bold=True), font(14)

    canvas = Image.new(
        'RGB',
        (panel_w + PAD * 2, PAD * 2 + len(PANELS) * (LABEL_H + panel_h) + (len(PANELS) - 1) * GAP),
        BG,
    )
    draw = ImageDraw.Draw(canvas)

    y = PAD
    for name, label, subtitle in PANELS:
        draw.text((PAD, y + 7), label, font=f_label, fill=INK)
        draw.text((PAD + draw.textlength(label, font=f_label) + 10, y + 8), subtitle, font=f_sub, fill=MUTED)
        y += LABEL_H

        crop = Image.open(SOURCE / name).convert('RGB').crop(CROP).resize((panel_w, panel_h), Image.LANCZOS)
        canvas.paste(crop, (PAD, y))
        draw.rectangle([PAD, y, PAD + panel_w - 1, y + panel_h - 1], outline=BORDER)
        y += panel_h + GAP

    OUT.parent.mkdir(exist_ok=True)
    canvas.save(OUT)
    print(f'wrote {OUT} {canvas.size}')


if __name__ == '__main__':
    main()
