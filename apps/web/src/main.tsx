import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { App } from './App';
import { LangProvider } from './i18n';
import { PlayerProvider } from './lib/player';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Web root element was not found');

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      <PlayerProvider>
        {/* reducedMotion="user" makes every framer-motion transition respect prefers-reduced-motion */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </MotionConfig>
      </PlayerProvider>
    </LangProvider>
  </StrictMode>,
);
