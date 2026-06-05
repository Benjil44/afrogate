import { Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/home';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* Detail pages (/resellers, /gaming, /vpn) are a fast-follow. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
