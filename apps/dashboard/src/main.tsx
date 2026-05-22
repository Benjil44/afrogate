import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardApp } from './DashboardApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Dashboard root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <DashboardApp />
  </StrictMode>,
);

