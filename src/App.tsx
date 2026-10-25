import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import Calendar from './pages/Calendar';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Suggest from './pages/Suggest';
import Work from './pages/Work';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Home />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="suggest" element={<Suggest />} />
        <Route path="work" element={<Work />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/** GitHub Pages는 SPA 경로를 새로고침하면 404가 나서 해시 라우팅을 써요 (SPEC §2). */
export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </HashRouter>
  );
}
