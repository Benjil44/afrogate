import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LangProvider } from './i18n';
import { CollectionProvider } from './lib/collection';
import { PlayerProvider } from './lib/player';
import { MotionProvider } from './motion/provider';
import { ToastProvider } from './components/toast';
// Self-hosted variable fonts (OFL) bundled by Vite — no third-party font requests.
import '@fontsource-variable/vazirmatn/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Web root element was not found');

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      {/* PlayerProvider needs the motion tier (analyser gating) and the language (lock-screen album name). */}
      <MotionProvider>
        <PlayerProvider>
          <CollectionProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </CollectionProvider>
        </PlayerProvider>
      </MotionProvider>
    </LangProvider>
  </StrictMode>,
);
