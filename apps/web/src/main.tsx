import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { LangProvider } from './i18n';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Web root element was not found');

createRoot(root).render(
  <StrictMode>
    <LangProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LangProvider>
  </StrictMode>,
);
