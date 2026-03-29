import * as React from 'react';
import { useRouter } from '@tanstack/react-router';

interface ErrorFallbackProps {
  error: Error;
  reset?: () => void;
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="bg-destructive/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="text-destructive h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold">Turbulence Detected</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex justify-center gap-3">
          {reset && (
            <button
              onClick={reset}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium"
            >
              Try Again
            </button>
          )}
          <a href="/dashboard" className="hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium">
            Return to Flight Deck
          </a>
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
          <svg
            className="text-muted-foreground h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="mb-2 text-xl font-bold">Off Course</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/dashboard"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex rounded-md px-4 py-2 text-sm font-medium"
        >
          Return to Flight Deck
        </a>
      </div>
    </div>
  );
}
