import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { eq } from 'drizzle-orm';
import { candidates, db, tenants, users } from '@job-pilot/db';

function createId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${timestamp}_${random}`;
}

/**
 * Derive a URL-safe slug from an email address.
 * Takes the local part (before @), replaces non-alphanumeric characters with
 * hyphens, collapses consecutive hyphens, and trims leading/trailing hyphens.
 */
function slugFromEmail(email: string): string {
  const local = email.split('@')[0] || 'user';
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Derive a workspace name from the user's display name.
 * Falls back to the email local part if no name is provided.
 */
function workspaceName(name: string | undefined | null, email: string): string {
  if (name && name.trim().length > 0) {
    const first = name.trim().split(/\s+/)[0];
    return `${first}'s Workspace`;
  }
  const local = email.split('@')[0] || 'User';
  const capitalized = local.charAt(0).toUpperCase() + local.slice(1);
  return `${capitalized}'s Workspace`;
}

/**
 * Ensure the slug is unique by querying existing tenants. If a collision is
 * found, append a short random suffix and retry (up to 5 attempts).
 */
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
  // Final fallback: use a fully random slug
  return `${baseSlug}-${Math.random().toString(36).slice(2, 10)}`;
}

export const auth = betterAuth({
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
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  trustedOrigins: [process.env.APP_URL || 'http://localhost:3000'],
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

            // 1. Create a new tenant for this user
            await db.insert(tenants).values({
              id: tenantId,
              name: workspaceName(user.name, user.email),
              slug,
              plan: 'free',
            });

            // 2. Update the user with the new tenantId and admin role
            await db.update(users).set({ tenantId, role: 'admin' }).where(eq(users.id, user.id));

            // 3. Create a bare candidate profile
            await db.insert(candidates).values({
              id: createId(),
              userId: user.id,
              tenantId,
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
