import type { ReactNode } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import './Gallery.css';

type SpecimenProps = {
  /** Human-readable caption. Rendered OUTSIDE the `data-testid` wrapper. */
  name: string;
  /** The exact `data-testid` the visual suite screenshots. */
  testId: string;
  children: ReactNode;
};

/**
 * One gallery row: caption on the left, the isolated subject on the right.
 * The `data-testid` element wraps the component and nothing else, and hugs it
 * (`inline-flex`) so the element screenshot is not padded out to page width.
 */
function Specimen({ name, testId, children }: SpecimenProps) {
  return (
    <li className="specimen">
      <div className="specimen__meta">
        <p className="specimen__name">{name}</p>
        <p className="specimen__id">{testId}</p>
      </div>
      <div className="specimen__stage">
        <div className="specimen__subject" data-testid={testId}>
          {children}
        </div>
      </div>
    </li>
  );
}

export function Gallery() {
  return (
    <div className="page">
      <nav className="nav">
        <p className="nav__brand">pixel&#8202;/&#8202;perfect</p>
        <ul className="nav__links">
          <li>
            <a className="nav__link" href="#/">
              Overview
            </a>
          </li>
          <li>
            <a className="nav__link nav__link--current" href="#/components">
              Components
            </a>
          </li>
        </ul>
      </nav>

      <header className="gallery__intro">
        <p className="eyebrow">Snapshot surface</p>
        <h1 className="gallery__title">Component gallery</h1>
        <p className="gallery__lede">
          Six isolated states, one baseline each. Every state is driven purely by
          props and every value below resolves from a design token, so a single token
          edit is enough to turn this page red.
        </p>
      </header>

      <main>
        <ol className="gallery__list">
          <Specimen name="Button — primary" testId="btn-default">
            <Button>Run visual suite</Button>
          </Specimen>

          <Specimen name="Button — secondary" testId="btn-secondary">
            <Button variant="secondary">Update snapshots</Button>
          </Specimen>

          <Specimen name="Button — disabled" testId="btn-disabled">
            <Button disabled>Run visual suite</Button>
          </Specimen>

          <Specimen name="Badge — success" testId="badge-success">
            <Badge tone="success">Passing</Badge>
          </Specimen>

          <Specimen name="Badge — warn" testId="badge-warn">
            <Badge tone="warn">Flaky</Badge>
          </Specimen>

          <Specimen name="Badge — error" testId="badge-error">
            <Badge tone="error">Diff found</Badge>
          </Specimen>
        </ol>
      </main>

      <footer className="gallery__footer">
        <p className="gallery__footnote">
          The hover state of <span className="mono">btn-default</span> is captured in a
          seventh baseline, driven by <span className="mono">locator.hover()</span>
        </p>
      </footer>
    </div>
  );
}
