import * as React from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { signIn } from '~/lib/auth-client';
import { captureEvent } from '~/lib/posthog';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        captureEvent('login_failed', { error: result.error.message });
        setError(result.error.message || 'Invalid email or password');
      } else {
        captureEvent('login_succeeded');
        navigate({ to: '/dashboard' });
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center">
      <div className="mx-4 mb-4 w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        This product is in <span className="font-semibold">beta</span> and is subject to change and
        charge.
      </div>
      <div className="bg-card w-full max-w-md space-y-8 rounded-xl border p-8 shadow-lg">
        <div className="text-center">
          <div className="bg-primary mx-auto flex h-12 w-12 items-center justify-center rounded-xl">
            <svg
              className="text-primary-foreground h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold">Welcome back, Pilot</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to your cockpit</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pilot@example.com"
              required
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={8}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-muted-foreground text-center text-sm">
          New pilot?{' '}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
