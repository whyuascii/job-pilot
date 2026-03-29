import * as React from 'react';

import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';

import { ErrorFallback, NotFound } from '~/components/error-boundary';
import { SidebarLayout } from '~/components/sidebar-layout';
import { api } from '~/lib/api-client';
import { identifyUser, registerSuperProperties, setTenantGroup } from '~/lib/posthog';

const publicPaths = ['/login', '/signup', '/'];

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (
      location.pathname === '/' ||
      publicPaths.some((path) => path !== '/' && location.pathname.startsWith(path))
    ) {
      return {};
    }

    // Don't check auth for API routes
    if (location.pathname.startsWith('/api/')) {
      return {};
    }

    const session = await api.auth.getSession();

    if (!session) {
      throw new Error('Not authenticated');
    }

    return { session };
  },
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => {
    // If auth error, redirect to login
    if (error.message === 'Not authenticated') {
      return <RedirectToLogin />;
    }
    return <ErrorFallback error={error} reset={reset} />;
  },
  component: RootComponent,
});

function RedirectToLogin() {
  React.useEffect(() => {
    window.location.href = '/login';
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to login...</p>
    </div>
  );
}

function RootComponent() {
  const routerState = useRouterState();
  const isPublicPage =
    routerState.location.pathname === '/' ||
    publicPaths.some((path) => path !== '/' && routerState.location.pathname.startsWith(path));

  if (isPublicPage) {
    return <Outlet />;
  }

  return <AuthenticatedLayout />;
}

function AuthenticatedLayout() {
  const context = Route.useRouteContext();

  React.useEffect(() => {
    const session = context?.session;
    if (session?.user) {
      identifyUser(session.user.id, {
        email: session.user.email,
        name: session.user.name,
        createdAt: session.user.createdAt,
      });

      // Set tenant group for B2B analytics if available
      if (session.user.tenantId) {
        setTenantGroup(session.user.tenantId);
      }

      // Register super properties sent with every event
      registerSuperProperties({
        app_version: '1.0.0',
        platform: 'web',
      });
    }
  }, [context?.session]);

  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
}
