import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import './index.css';
import { Gallery } from './routes/Gallery';
import { Landing } from './routes/Landing';

const subscribeToHash = (onHashChange: () => void) => {
  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
};

const readHash = () => window.location.hash;

function App() {
  const hash = useSyncExternalStore(subscribeToHash, readHash);
  return hash === '#/components' ? <Gallery /> : <Landing />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
