import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { RequireProfile } from './components/RequireProfile';
import { useApplyTheme } from './hooks/useApplyTheme';
import { useTheme } from './hooks/useTheme';
import Calendar from './pages/Calendar';
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Suggest from './pages/Suggest';
import Work from './pages/Work';

export function AppRoutes() {
  // 온보딩 화면에도 테마가 적용되도록 가장 위에서 반영해요.
  const { theme } = useTheme();
  useApplyTheme(theme);

  return (
    <Routes>
      <Route path="onboarding" element={<Onboarding />} />
      <Route element={<RequireProfile />}>
        <Route element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="suggest" element={<Suggest />} />
          <Route path="work" element={<Work />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** GitHub Pages는 SPA 경로를 새로고침하면 404가 나서 해시 라우팅을 써요 (SPEC §2). */
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
