import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClientApp } from './ClientApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Client root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <ClientApp />
  </StrictMode>,
);
