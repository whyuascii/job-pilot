import { expect, test } from '@playwright/test';

/**
 * Answer bank page tests.
 *
 * The /answers route requires authentication. These tests verify:
 * 1. The auth guard protects the answers route
 * 2. The route is properly registered
 *
 * Answer bank page includes:
 * - "Black Box" heading with description
 * - Category filter tabs: All, Technical, Behavioral, Motivational, Logistical, Cultural
 * - Search input for finding answers
 * - "Add Answer" button
 * - "Find Similar" semantic search button
 * - Collapsible "New Answer" form with:
 *   - Question field
 *   - Answer field
 *   - Category dropdown
 *   - Tags input
 * - Answer cards showing question, answer preview, category badge, tags
 * - Empty state: "Your Black Box is empty"
 */

test.describe('Answers - Auth Guard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/answers');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Answers - Route Registration', () => {
  test('answers route exists at /answers', async ({ page }) => {
    const response = await page.goto('/answers');
    expect(response?.status()).not.toBe(404);
  });

  test('answers route redirects to login with correct landing page', async ({ page }) => {
    await page.goto('/answers');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
  });
});

test.describe('Answers - Page Structure Verification', () => {
  /**
   * The answers page has these structural elements:
   *
   * 1. Header: "Black Box" with aviation-themed description
   * 2. Category filter pills for quick filtering
   * 3. Search input for text-based search
   * 4. "Add Answer" button that toggles a collapsible form
   * 5. "Find Similar" button for semantic similarity search
   * 6. Answer cards with:
   *    - Question text
   *    - Answer preview (truncated)
   *    - Category badge (Technical, Behavioral, etc.)
   *    - Tags
   *    - Edit and delete actions
   * 7. Pagination ("Show More" button)
   * 8. Empty state when no answers exist
   *
   * Since these require auth to render, we verify the route protection.
   */

  test('answers route is protected by auth', async ({ page }) => {
    await page.goto('/answers');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

test.describe('Answers - Additional Routes', () => {
  test('recruiter-messages route exists and is protected', async ({ page }) => {
    const response = await page.goto('/recruiter-messages');
    expect(response?.status()).not.toBe(404);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('analytics route exists and is protected', async ({ page }) => {
    const response = await page.goto('/analytics');
    expect(response?.status()).not.toBe(404);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('settings route exists and is protected', async ({ page }) => {
    const response = await page.goto('/settings');
    expect(response?.status()).not.toBe(404);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
