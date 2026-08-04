import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import './Landing.css';

/**
 * Composed marketing-style page. Fully static: no state, no effects, no clock.
 * The only moving part is the footer timestamp, which is hardcoded precisely so
 * the suite can demonstrate `mask:` on genuinely dynamic content.
 *
 * Exactly one <header> exists on this route (the hero) — the visual suite
 * targets `page.locator('header')` in strict mode.
 */
export function Landing() {
  return (
    <div className="page">
      <nav className="nav">
        <p className="nav__brand">pixel&#8202;/&#8202;perfect</p>
        <ul className="nav__links">
          <li>
            <a className="nav__link nav__link--current" href="#/">
              Overview
            </a>
          </li>
          <li>
            <a className="nav__link" href="#/components">
              Components
            </a>
          </li>
        </ul>
      </nav>

      <header className="hero">
        <p className="eyebrow">Visual regression, proven</p>
        <h1 className="hero__title">
          Catch the pixel that nobody
          <br />
          meant to move.
        </h1>
        <p className="hero__lede">
          A deterministic UI, a containerised browser, and a baseline per component.
          Change one design token and the suite tells you exactly which surfaces
          drifted — and which ones did not.
        </p>
        <div className="hero__actions">
          <Button>Run the suite</Button>
          <Button variant="secondary">Read the plan</Button>
        </div>
      </header>

      <main>
        <section className="section">
          <div className="section__head">
            <p className="eyebrow">How it holds still</p>
            <h2 className="section__title">Three rules, no exceptions</h2>
          </div>
          <div className="cards">
            <Card
              elevated
              title="Tokens are the only lever"
              body="No component hardcodes a colour or a spacing value. Every pixel traces back to one custom property, so a regression has exactly one cause."
            />
            <Card
              title="Nothing animates"
              body="No transitions, no keyframes, no easing. A screenshot taken at any moment is the same screenshot, which removes the usual source of flake."
            />
            <Card
              title="Time is masked, not faked"
              body="One deliberate timestamp lives in the footer. The suite masks it instead of freezing the clock — the honest escape hatch for real dynamic data."
            />
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <p className="eyebrow">Last run</p>
            <h2 className="section__title">Baseline status</h2>
          </div>
          <div className="statuses">
            <div className="status">
              <Badge tone="success">Passing</Badge>
              <p className="status__label">12 component baselines</p>
            </div>
            <div className="status">
              <Badge tone="warn">Flaky</Badge>
              <p className="status__label">0 quarantined specs</p>
            </div>
            <div className="status">
              <Badge tone="error">Diff found</Badge>
              <p className="status__label">0 unreviewed diffs</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p className="footer__note">
          Baselines are generated inside the container. Never on the host.
        </p>
        <span data-testid="timestamp">Last updated: 2026-08-03 20:41:07 UTC</span>
      </footer>
    </div>
  );
}
