import * as React from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Compass,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Plane,
  Settings,
  User,
  X,
} from 'lucide-react';

import { NotificationBell } from '~/components/notification-bell';

const navItems = [
  { to: '/dashboard', label: 'Flight Deck', icon: LayoutDashboard },
  { to: '/jobs', label: 'Flight Plan', icon: Compass },
  { to: '/career-goals', label: 'Career Goals', icon: GraduationCap },
  { to: '/profile', label: 'Pilot Profile', icon: User },
  { to: '/applications', label: 'Flight Log', icon: ClipboardList },
  { to: '/answers', label: 'Black Box', icon: BookOpen },
  { to: '/flight-records', label: 'Flight Records', icon: FileText },
  { to: '/recruiter-messages', label: 'Comms Intercept', icon: Mail },
  { to: '/analytics', label: 'Flight Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Ground Control', icon: Settings },
] as const;

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const handleSignOut = React.useCallback(async () => {
    const { resetUser, captureEvent } = await import('~/lib/posthog');
    captureEvent('user_signed_out');
    resetUser();
    const { signOut } = await import('~/lib/auth-client');
    await signOut();
    window.location.href = '/login';
  }, []);

  // Shared sidebar content used by both desktop and mobile
  const sidebarNav = (
    <nav className="flex-1 space-y-1 p-3">
      {navItems.map(({ to, label, icon: Icon }) => {
        const isActive = currentPath.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="bg-card flex h-14 items-center justify-between border-b px-4 md:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
            <Plane className="text-primary-foreground h-4 w-4" />
          </div>
          <span className="text-lg font-bold tracking-tight">Job Pilot</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out sidebar */}
      <aside
        className={`bg-card fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Plane className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Job Pilot</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        {sidebarNav}

        {/* Beta banner */}
        <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] leading-tight text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-semibold">Beta</span> — subject to change and charge.
        </div>

        {/* User & Logout */}
        <div className="border-t p-3">
          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="bg-card sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r md:flex">
        {/* Logo & Notifications */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Plane className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Job Pilot</span>
          </div>
          <NotificationBell />
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = currentPath.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Beta banner */}
        <div className="mx-3 mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-[11px] leading-tight text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <span className="font-semibold">Beta</span> — subject to change and charge.
        </div>

        {/* User & Logout */}
        <div className="border-t p-3">
          <button
            onClick={handleSignOut}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
