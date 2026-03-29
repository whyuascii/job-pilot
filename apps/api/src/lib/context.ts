import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = asyncLocalStorage.getStore();
  if (!ctx) {
    throw new Error('No tenant context available');
  }
  return ctx;
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return asyncLocalStorage.run(ctx, fn);
}
