import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { createRouter } from './router';
import { initPostHog, capturePageView } from './lib/posthog';
import './styles/app.css';

initPostHog();

const router = createRouter();

// Track route changes for PostHog pageviews
router.subscribe('onResolved', ({ toLocation }) => {
  capturePageView(toLocation.href);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
