import { useLiveQuery } from 'dexie-react-hooks';
import { Navigate, Outlet } from 'react-router';
import { getProfile } from '../db/repo';

/** 프로필이 없으면 어떤 경로로 들어와도 온보딩으로 보내요 (SPEC §8.1). */
export function RequireProfile() {
  const profile = useLiveQuery(async () => (await getProfile()) ?? null, [], 'loading' as const);
  if (profile === 'loading') return null;
  if (profile === null) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
