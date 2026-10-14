import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LangProvider } from './i18n';
import { PlayerProvider } from './lib/player';
import { MotionProvider } from './motion/provider';
// Self-hosted variable fonts (OFL) bundled by Vite — no third-party font requests.
import '@fontsource-variable/vazirmatn/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Web root element was not found');

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      {/* MotionProvider needs the language (RTL mirroring); PlayerProvider needs the motion tier (analyser gating). */}
      <MotionProvider>
        <PlayerProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PlayerProvider>
      </MotionProvider>
    </LangProvider>
  </StrictMode>,
);
