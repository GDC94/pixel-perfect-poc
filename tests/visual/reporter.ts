import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

/**
 * A reporter for reading visual diffs, not for counting tests.
 *
 * Playwright's built-in reporters answer "how many failed?". For a visual suite
 * that is the least interesting question. The useful ones are:
 *
 *   - What changed, and did it change SHAPE or just colour?
 *   - What stayed green? (that list tells you where not to look)
 *   - Where are the diff images, and what do I type next?
 *
 * The last point matters more than it sounds. The natural reflex on a red
 * visual suite is to re-record the baselines and move on, which silently
 * promotes a bug to the expected result. So the failure output states the
 * update command AND the condition under which running it is legitimate.
 */

const PALETTE = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Honour NO_COLOR and non-TTY output (CI logs, pipes into grep).
const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: keyof typeof PALETTE, text: string) =>
  useColour ? `${PALETTE[code]}${text}${PALETTE.reset}` : text;

const RULE = '─'.repeat(66);

type Change =
  | { kind: 'geometry'; from: string; to: string }
  | { kind: 'pixels'; count: number; ratio: number }
  | { kind: 'missing' }
  | { kind: 'other'; message: string };

type Failure = { name: string; change: Change };

/**
 * Report the SNAPSHOT name, not the test title.
 *
 * They drift apart: the test `landing tolerates sub-perceptual colour drift`
 * writes `landing-tolerant.png`, and `btn-default hover state` writes
 * `btn-hover.png`. The filename is what you go looking for on disk, so that is
 * what belongs in the output.
 *
 * On failure Playwright attaches `<snapshot>-expected|actual|diff`, which gives
 * us the real name. A passing test has no attachments, so fall back to tidying
 * the title.
 */
function snapshotName(test: TestCase, result: TestResult): string {
  for (const attachment of result.attachments) {
    const match = attachment.name.match(/^(.*)-(expected|actual|diff|previous)\.png$/);
    if (match) return match[1];
  }
  return test.title.replace(/\s+matches baseline$/, '').replace(/\s+state$/, '');
}

/**
 * Playwright encodes the interesting part of a visual failure in prose. Pulling
 * the numbers back out lets us say "shape changed" instead of making the reader
 * parse a sentence.
 */
function classify(result: TestResult): Change {
  const message = result.errors.map((e) => e.message ?? '').join('\n');

  const geometry = message.match(
    /Expected an image (\d+)px by (\d+)px, received (\d+)px by (\d+)px/,
  );
  if (geometry) {
    const [, ew, eh, aw, ah] = geometry;
    return { kind: 'geometry', from: `${ew}×${eh}`, to: `${aw}×${ah}` };
  }

  const pixels = message.match(/(\d+) pixels \(ratio ([\d.]+) of all image pixels\)/);
  if (pixels) {
    return { kind: 'pixels', count: Number(pixels[1]), ratio: Number(pixels[2]) };
  }

  if (/snapshot doesn't exist/i.test(message)) return { kind: 'missing' };

  const firstLine = (message.split('\n').find((l) => l.trim()) ?? 'unknown failure').trim();
  return { kind: 'other', message: firstLine };
}

function describe(change: Change): string {
  switch (change.kind) {
    case 'geometry':
      return `${paint('yellow', change.from.padStart(9))} → ${paint('yellow', change.to.padEnd(9))} ${paint('dim', 'shape changed')}`;
    case 'pixels':
      return `${paint('yellow', change.count.toLocaleString().padStart(9))} px  ${paint('dim', `${(change.ratio * 100).toFixed(1)}% of the image`)}`;
    case 'missing':
      return paint('dim', 'no baseline recorded yet');
    case 'other':
      return paint('dim', change.message.slice(0, 44));
  }
}

export default class VisualReporter implements Reporter {
  private failures: Failure[] = [];
  private passes: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const name = snapshotName(test, result);
    if (result.status === 'passed') {
      this.passes.push(name);
      return;
    }
    if (result.status === 'skipped') return;
    this.failures.push({ name, change: classify(result) });
  }

  onEnd(result: FullResult): void {
    const total = this.passes.length + this.failures.length;
    const out = console.log;

    // Tests finish in whatever order the workers release them. Sorting keeps the
    // output diffable between runs, which is the same discipline the suite is
    // enforcing on the pixels.
    this.failures.sort((a, b) => a.name.localeCompare(b.name));
    this.passes.sort((a, b) => a.localeCompare(b));

    out('');
    out(RULE);

    if (result.status === 'passed') {
      out(
        `  ${paint('green', paint('bold', 'VISUAL SUITE PASSED'))}   ${total}/${total} snapshots match their baselines`,
      );
      out('');
      out(paint('dim', '  Every rendered pixel is identical to what was committed.'));
      out(
        paint(
          'dim',
          '  Baselines live in tests/visual/__screenshots__/ and are reviewed like code.',
        ),
      );
      out(RULE);
      out('');
      return;
    }

    out(
      `  ${paint('red', paint('bold', 'VISUAL DIFFERENCES FOUND'))}   ${this.failures.length} changed · ${this.passes.length} unchanged`,
    );

    const width = Math.max(...this.failures.map((f) => f.name.length), 12);

    out('');
    out(`  ${paint('red', 'CHANGED')}`);
    for (const f of this.failures) {
      out(`    ${f.name.padEnd(width)}  ${describe(f.change)}`);
    }

    if (this.passes.length) {
      out('');
      out(`  ${paint('green', 'UNCHANGED')}  ${paint('dim', '(these tell you where not to look)')}`);
      out(`    ${paint('dim', this.passes.join(', '))}`);
    }

    out('');
    out(`  ${paint('cyan', 'See the diffs')}`);
    out(`    pnpm test:visual:report        ${paint('dim', 'expected / actual / diff, side by side')}`);
    out(`    ${paint('dim', 'raw images: test-results/')}`);

    out('');
    out(`  ${paint('cyan', 'If you meant to make this change')}`);
    out(`    pnpm test:visual:docker:update`);
    out('');
    out(
      paint(
        'dim',
        '    Only run that once you have LOOKED at the diff and the new rendering',
      ),
    );
    out(
      paint(
        'dim',
        '    is what you intended. Re-recording a baseline to get to green turns',
      ),
    );
    out(paint('dim', '    a bug into the expected result, permanently.'));
    out(
      paint(
        'dim',
        '    Always inside the container. macOS baselines do not match Linux CI.',
      ),
    );

    out(RULE);
    out('');
  }
}
