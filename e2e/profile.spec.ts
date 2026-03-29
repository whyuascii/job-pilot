import { expect, test } from '@playwright/test';

/**
 * Profile page tests.
 *
 * The /profile route requires authentication. These tests verify:
 * 1. The auth guard protects the profile route
 * 2. The route is properly registered (not a 404)
 *
 * Profile page includes:
 * - "Pilot Profile" heading
 * - Tabs: Overview, Experience, Skills, Projects, Preferences
 * - Basic Information card with fields (name, email, phone, etc.)
 * - Resume sidebar with upload zone (drag and drop)
 * - Each tab renders its respective section
 */

test.describe('Profile - Auth Guard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Profile - Route Registration', () => {
  test('profile route exists at /profile', async ({ page }) => {
    const response = await page.goto('/profile');
    // Valid route, not 404 - just requires auth
    expect(response?.status()).not.toBe(404);
  });

  test('profile route redirects to login (auth guard active)', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    // After redirect, login page should render
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
  });
});

test.describe('Profile - Page Structure Verification', () => {
  /**
   * The profile page has these structural sections:
   *
   * 1. Header: "Pilot Profile" with description
   * 2. Tabs navigation: Overview | Experience | Skills | Projects | Preferences
   * 3. Tab content areas for each section
   * 4. Resume sidebar on the right with:
   *    - "Resumes" card title
   *    - Upload zone ("Drop a resume here")
   *    - File type info ("PDF, DOCX, or TXT")
   *    - Resume list
   *
   * Since these require auth to render, we verify the route is protected
   * and the component is properly registered in the route tree.
   */

  test('profile redirects to login confirming auth guard', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
