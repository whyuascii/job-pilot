import type { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[API Error]', err.message);

  // Map common error messages to HTTP status codes
  const message = err.message || 'Internal server error';

  if (message.includes('Unauthorized') || message.includes('Authentication failed')) {
    res.status(401).json({ error: message });
    return;
  }

  if (message.includes('not found') || message.includes('Not found')) {
    res.status(404).json({ error: message });
    return;
  }

  if (message.includes('Rate limit exceeded')) {
    res.status(429).json({ error: message });
    return;
  }

  if (message.includes('Invalid') || message.includes('too short') || message.includes('required')) {
    res.status(400).json({ error: message });
    return;
  }

  if (message.includes('No tenant') || message.includes('forbidden')) {
    res.status(403).json({ error: message });
    return;
  }

  res.status(500).json({ error: message });
}
