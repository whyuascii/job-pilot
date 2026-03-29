import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { db, tenants, users, candidates } from '@job-pilot/db';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

function slugFromEmail(email: string): string {
  const local = email.split('@')[0] || 'user';
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function workspaceName(name: string | undefined | null, email: string): string {
  if (name && name.trim().length > 0) {
    const first = name.trim().split(/\s+/)[0];
    return `${first}'s Workspace`;
  }
  const local = email.split('@')[0] || 'User';
  const capitalized = local.charAt(0).toUpperCase() + local.slice(1);
  return `${capitalized}'s Workspace`;
}

async function uniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
    const suffix = Math.random().toString(36).slice(2, 8);
    slug = `${baseSlug}-${suffix}`;
  }
  return `${baseSlug}-${Math.random().toString(36).slice(2, 10)}`;
}

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_URL = process.env.API_URL || ''; // Set for cross-origin ECS deployments

// Collect unique trusted origins (APP_URL + API_URL if different)
const trustedOrigins = [APP_URL];
if (API_URL && API_URL !== APP_URL) {
  trustedOrigins.push(API_URL);
}

export const auth = betterAuth({
  baseURL: APP_URL,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  trustedOrigins,
  user: {
    additionalFields: {
      tenantId: {
        type: 'string',
        required: false,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'member',
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async after(user) {
          try {
            const tenantId = createId();
            const slug = await uniqueSlug(slugFromEmail(user.email));

            await db.insert(tenants).values({
              id: tenantId,
              name: workspaceName(user.name, user.email),
              slug,
              plan: 'free',
            });

            await db
              .update(users)
              .set({ tenantId, role: 'admin' })
              .where(eq(users.id, user.id));

            await db.insert(candidates).values({
              id: createId(),
              userId: user.id,
              tenantId,
              email: user.email,
              headline: 'New Pilot',
              currentTitle: 'Job Seeker',
              location: 'Not set',
              remotePreference: 'flexible',
            });
          } catch (error) {
            console.error('Failed to provision tenant and candidate profile during signup:', error);
            throw error;
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
