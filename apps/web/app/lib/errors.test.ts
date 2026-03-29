import { describe, it, expect, vi } from 'vitest';
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  handleServerError,
} from './errors';

// ---------------------------------------------------------------------------
// Tests for the error class hierarchy and handleServerError utility.
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('creates error with default values', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.name).toBe('AppError');
  });

  it('creates error with custom status code', () => {
    const err = new AppError('Bad request', 400);
    expect(err.statusCode).toBe(400);
  });

  it('creates error with custom code', () => {
    const err = new AppError('Rate limited', 429, 'RATE_LIMITED');
    expect(err.code).toBe('RATE_LIMITED');
  });

  it('is an instance of Error', () => {
    const err = new AppError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('has a stack trace', () => {
    const err = new AppError('test');
    expect(err.stack).toBeDefined();
  });
});

describe('NotFoundError', () => {
  it('creates error with default resource message', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
  });

  it('creates error with custom resource name', () => {
    const err = new NotFoundError('Job');
    expect(err.message).toBe('Job not found');
  });

  it('is an instance of AppError', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnauthorizedError', () => {
  it('creates error with default message', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.name).toBe('UnauthorizedError');
  });

  it('creates error with custom message', () => {
    const err = new UnauthorizedError('Invalid token');
    expect(err.message).toBe('Invalid token');
  });

  it('is an instance of AppError', () => {
    const err = new UnauthorizedError();
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('creates error with default message', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe('Forbidden');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.name).toBe('ForbiddenError');
  });

  it('creates error with custom message', () => {
    const err = new ForbiddenError('Admin access required');
    expect(err.message).toBe('Admin access required');
  });

  it('is an instance of AppError', () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ValidationError', () => {
  it('creates error with field errors', () => {
    const errors = { name: ['Required'], email: ['Invalid email'] };
    const err = new ValidationError(errors);
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
    expect(err.errors).toEqual(errors);
  });

  it('creates error with empty errors object', () => {
    const err = new ValidationError({});
    expect(err.errors).toEqual({});
  });

  it('creates error with multiple errors per field', () => {
    const errors = { password: ['Too short', 'Must contain number', 'Must contain uppercase'] };
    const err = new ValidationError(errors);
    expect(err.errors.password).toHaveLength(3);
  });

  it('is an instance of AppError', () => {
    const err = new ValidationError({});
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('handleServerError', () => {
  it('re-throws AppError instances unchanged', () => {
    const original = new AppError('Test error', 400, 'TEST');
    expect(() => handleServerError(original)).toThrow(original);
  });

  it('re-throws NotFoundError unchanged', () => {
    const original = new NotFoundError('Job');
    expect(() => handleServerError(original)).toThrow(original);
  });

  it('re-throws UnauthorizedError unchanged', () => {
    const original = new UnauthorizedError();
    expect(() => handleServerError(original)).toThrow(original);
  });

  it('re-throws ValidationError unchanged', () => {
    const original = new ValidationError({ field: ['error'] });
    expect(() => handleServerError(original)).toThrow(original);
  });

  it('wraps generic Error into AppError with 500 status', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = new Error('Some internal error');

    try {
      handleServerError(original);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(500);
      expect((err as AppError).code).toBe('INTERNAL_ERROR');
      expect((err as AppError).message).toBe('An unexpected error occurred');
      // Should not leak the original error message
      expect((err as AppError).message).not.toContain('Some internal error');
    }

    consoleSpy.mockRestore();
  });

  it('wraps non-Error values into AppError', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      handleServerError('string error');
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(500);
    }

    consoleSpy.mockRestore();
  });

  it('logs the original error server-side', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = new Error('Detailed internal error');

    try {
      handleServerError(original);
    } catch {
      // Expected
    }

    expect(consoleSpy).toHaveBeenCalledWith('[server-error]', original);
    consoleSpy.mockRestore();
  });
});
