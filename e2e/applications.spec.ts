import { test, expect } from '@playwright/test';

/**
 * Applications page tests.
 *
 * The /applications route requires authentication. These tests verify:
 * 1. The auth guard protects the applications route
 * 2. Both listing and detail routes are properly registered
 *
 * Applications page includes:
 * - "Flight Log" heading
 * - Tab filters: All, Radar Contact, Filed, Climbing, Cruising, Landed, Diverted
 * - View toggle: List | Pipeline (kanban-style)
 * - Application cards with status badges
 * - Empty state: "No flights logged"
 * - Detail page at /applications/$applicationId
 */

test.describe('Applications - Auth Guard', () => {
  test('redirects unauthenticated users to login from listing', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('redirects unauthenticated users to login from detail', async ({ page }) => {
    await page.goto('/applications/test-app-id');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Applications - Route Registration', () => {
  test('applications listing route exists at /applications', async ({ page }) => {
    const response = await page.goto('/applications');
    expect(response?.status()).not.toBe(404);
  });

  test('applications detail route exists at /applications/$applicationId', async ({ page }) => {
    const response = await page.goto('/applications/test-id');
    expect(response?.status()).not.toBe(404);
  });

  test('applications listing redirects to login with correct page', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
  });
});

test.describe('Applications - Page Structure Verification', () => {
  /**
   * The applications page has these structural elements:
   *
   * 1. Header: "Flight Log" with description about tracking applications
   * 2. Status filter tabs: All, Radar Contact, Filed, Climbing, Cruising, Landed, Diverted
   * 3. View mode toggle: List | Pipeline
   * 4. ListView: tab-filtered list of application cards
   * 5. PipelineView: kanban-style columns
   *    - Radar Contact, In Progress, Interview Phase, Final, Outcomes
   * 6. Application cards showing:
   *    - Job title and company
   *    - Status badge
   *    - Location and date info
   * 7. Empty state when no applications exist
   *
   * Since these require auth to render, we verify the route protection.
   */

  test('application routes are protected by auth', async ({ page }) => {
    await page.goto('/applications');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
