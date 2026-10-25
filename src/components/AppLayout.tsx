import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApplyTheme } from '../hooks/useApplyTheme';
import { useUiStore } from '../store/ui';
import { SettingsIcon } from './icons';
import { MAIN_TABS, SETTINGS_TAB, type NavItem } from './navItems';
import { ThemeToggle } from './ThemeToggle';

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

/** 모바일 하단 탭. 현재 탭은 색에 더해 굵은 글씨와 위쪽 막대로 표시해요. */
function TabLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex h-16 flex-col items-center justify-center gap-1 text-xs ${focusRing} ${
          isActive
            ? 'font-semibold text-blue-600 dark:text-blue-400'
            : 'text-gray-500 dark:text-gray-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span aria-hidden="true" className="absolute top-0 h-1 w-10 rounded-b bg-current" />
          )}
          <Icon />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

/** 768px 이상 사이드바 메뉴 */
function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex h-11 items-center gap-3 rounded-lg px-3 text-sm ${focusRing} ${
          isActive
            ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        }`
      }
    >
      <Icon />
      {item.label}
    </NavLink>
  );
}

export function AppLayout() {
  const theme = useUiStore((s) => s.theme);
  useApplyTheme(theme);

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-r md:border-gray-200 md:px-3 md:py-4 md:dark:border-gray-800">
        <p className="px-3 pb-4 text-lg font-bold">연차 플래너</p>
        <nav aria-label="주요 메뉴" className="flex flex-1 flex-col gap-1">
          {[...MAIN_TABS, SETTINGS_TAB].map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>
        <ThemeToggle showLabel />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 pl-4 pr-1 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 md:hidden">
          <p className="text-lg font-bold">연차 플래너</p>
          <div className="flex items-center">
            <ThemeToggle />
            <Link
              to={SETTINGS_TAB.to}
              aria-label={SETTINGS_TAB.label}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 ${focusRing}`}
            >
              <SettingsIcon />
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:pb-10">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="하단 탭"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-4 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 md:hidden"
      >
        {MAIN_TABS.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}
