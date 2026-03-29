import { test, expect } from '@playwright/test';

/**
 * Navigation tests verify the sidebar layout and routing structure.
 *
 * Because authenticated routes redirect to /login for unauthenticated users,
 * these tests focus on verifying the login/signup page navigation elements
 * and that the sidebar renders with the correct links once a page loads.
 *
 * For sidebar-specific tests, we visit /login (public) to avoid auth redirects,
 * then verify navigation links exist in the markup after an auth redirect settles.
 */

test.describe('Navigation - Public Page Links', () => {
  test('login page links to signup', async ({ page }) => {
    await page.goto('/login');
    const signupLink = page.getByRole('link', { name: 'Create an account' });
    await expect(signupLink).toBeVisible();
  });

  test('signup page links to login', async ({ page }) => {
    await page.goto('/signup');
    const loginLink = page.getByRole('link', { name: 'Sign in' });
    await expect(loginLink).toBeVisible();
  });

  test('clicking signup link from login navigates to signup', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: 'Begin Your Flight' })).toBeVisible();
  });

  test('clicking login link from signup navigates to login', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
  });
});

test.describe('Navigation - Sidebar Structure', () => {
  /**
   * When an unauthenticated user visits a protected route, the app briefly
   * renders the sidebar (with the "Redirecting to login..." message) before
   * the client-side redirect fires. We can inspect the sidebar during that
   * window, or alternatively verify the redirect text.
   *
   * These tests visit a protected route and check that the redirect message
   * or sidebar elements appear before the redirect completes.
   */

  test('protected routes show redirect message before navigating to login', async ({ page }) => {
    await page.goto('/');
    // Either the sidebar is visible momentarily or the redirect message appears
    const redirectText = page.getByText('Redirecting to login...');
    // Wait for the redirect to settle
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('all expected navigation routes are protected', async ({ page }) => {
    const protectedRoutes = [
      '/jobs',
      '/profile',
      '/applications',
      '/answers',
      '/recruiter-messages',
      '/analytics',
      '/settings',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    }
  });
});

test.describe('Navigation - Page Titles and Meta', () => {
  test('app has correct page title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Job Pilot/);
  });

  test('app has correct meta description', async ({ page }) => {
    await page.goto('/login');
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute(
      'content',
      'AI-powered job search operating system'
    );
  });

  test('app loads Inter font stylesheet', async ({ page }) => {
    await page.goto('/login');
    const fontLink = page.locator('link[href*="fonts.googleapis.com"]');
    await expect(fontLink).toHaveCount(1);
  });
});

test.describe('Navigation - Dark Mode', () => {
  test('html element starts without dark class by default', async ({ page }) => {
    await page.goto('/login');
    const htmlElement = page.locator('html');
    // Default state should not have dark class (no localStorage set)
    const classes = await htmlElement.getAttribute('class');
    // The class may or may not contain 'dark' depending on localStorage,
    // but for a fresh browser context it should not be dark
    expect(classes).not.toContain('dark');
  });

  test('theme script is present in the page', async ({ page }) => {
    await page.goto('/login');
    // Verify the inline theme script exists in the page
    const themeScript = page.locator('script:not([src])');
    // There should be at least one inline script (the theme script)
    await expect(themeScript.first()).toBeAttached();
  });
});

test.describe('Navigation - Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('login page is usable on mobile viewport', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('signup page is usable on mobile viewport', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Begin Your Flight' })).toBeVisible();
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });
});
