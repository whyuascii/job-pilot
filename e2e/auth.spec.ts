import { expect, test } from '@playwright/test';

test.describe('Authentication - Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders the login page with branding', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
    await expect(page.getByText('Sign in to your cockpit')).toBeVisible();
  });

  test('renders email and password form fields', async ({ page }) => {
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(emailInput).toHaveAttribute('placeholder', 'pilot@example.com');

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('renders the sign in button', async ({ page }) => {
    const signInButton = page.getByRole('button', { name: 'Sign In' });
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toBeEnabled();
  });

  test('renders the link to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: 'Create an account' });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', /\/signup/);
  });

  test('email field has required attribute', async ({ page }) => {
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('password field has required and minLength attributes', async ({ page }) => {
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('can type into email and password fields', async ({ page }) => {
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password');

    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');

    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('password123');
  });
});

test.describe('Authentication - Signup Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/signup');
  });

  test('renders the signup page with branding', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Begin Your Flight' })).toBeVisible();
    await expect(page.getByText('Create your pilot account')).toBeVisible();
  });

  test('renders all signup form fields', async ({ page }) => {
    const nameInput = page.getByLabel('Full Name');
    const emailInput = page.getByLabel('Email');
    const passwordInput = page.getByLabel('Password', { exact: true });
    const confirmPasswordInput = page.getByLabel('Confirm Password');

    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveAttribute('placeholder', 'Captain Smith');

    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute('type', 'email');

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    await expect(confirmPasswordInput).toBeVisible();
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });

  test('renders the create account button', async ({ page }) => {
    const createButton = page.getByRole('button', { name: 'Create Account' });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
  });

  test('renders the link to login page', async ({ page }) => {
    const loginLink = page.getByRole('link', { name: 'Sign in' });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', /\/login/);
  });

  test('all signup fields have required attribute', async ({ page }) => {
    await expect(page.getByLabel('Full Name')).toHaveAttribute('required', '');
    await expect(page.getByLabel('Email')).toHaveAttribute('required', '');
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('required', '');
    await expect(page.getByLabel('Confirm Password')).toHaveAttribute('required', '');
  });

  test('can type into all signup fields', async ({ page }) => {
    await page.getByLabel('Full Name').fill('John Doe');
    await page.getByLabel('Email').fill('john@example.com');
    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Confirm Password').fill('password123');

    await expect(page.getByLabel('Full Name')).toHaveValue('John Doe');
    await expect(page.getByLabel('Email')).toHaveValue('john@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('password123');
    await expect(page.getByLabel('Confirm Password')).toHaveValue('password123');
  });
});

test.describe('Authentication - Auth Guard', () => {
  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/');
    // The app shows "Redirecting to login..." and then redirects via window.location.href
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated access to jobs page redirects to login', async ({ page }) => {
    await page.goto('/jobs');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated access to profile page redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('unauthenticated access to settings page redirects to login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('login page is accessible without authentication', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome back, Pilot' })).toBeVisible();
  });

  test('signup page is accessible without authentication', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: 'Begin Your Flight' })).toBeVisible();
  });
});
