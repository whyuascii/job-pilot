import React from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@job-pilot/ui';
import { api } from '~/lib/api-client';

export const Route = createFileRoute('/gmail-callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: (search.code as string) || '',
    error: (search.error as string) || '',
  }),
  component: GmailCallbackPage,
});

function GmailCallbackPage() {
  const { code, error: oauthError } = Route.useSearch();
  const navigate = useNavigate();
  const [status, setStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = React.useState('');
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (oauthError) {
      setStatus('error');
      setErrorMessage(`Google authorization failed: ${oauthError}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage('No authorization code received from Google.');
      return;
    }

    api.gmail.callback({ code })
      .then(() => {
        setStatus('success');
        // Auto-redirect after a short delay
        setTimeout(() => {
          navigate({ to: '/settings' });
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to connect Gmail.');
      });
  }, [code, oauthError, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center space-y-4">
        {status === 'processing' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-sky-500 mx-auto" />
            <h1 className="text-xl font-semibold">Connecting Gmail...</h1>
            <p className="text-muted-foreground text-sm">
              Exchanging authorization code and securely storing your tokens.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold">Gmail Connected!</h1>
            <p className="text-muted-foreground text-sm">
              Your Gmail account has been linked successfully. Redirecting to settings...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-semibold">Connection Failed</h1>
            <p className="text-sm text-red-600">
              {errorMessage}
            </p>
            <Button
              variant="outline"
              onClick={() => navigate({ to: '/settings' })}
            >
              Back to Settings
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
