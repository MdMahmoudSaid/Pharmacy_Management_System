import {createHash, randomBytes} from 'node:crypto';

import {and, eq, gt, isNull} from 'drizzle-orm';
import {cookies} from 'next/headers';

import {db} from '@/db/client';
import {sessions, users} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {loadPermissionActor} from '@/modules/permissions/service';

export const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME ?? 'pharmacy_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

export const hashSessionToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId,
    expiresAt
  });
  return {token, expiresAt};
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(sessions)
    .set({revokedAt: new Date()})
    .where(eq(sessions.tokenHash, hashSessionToken(token)));
}

export async function revokeUserSessions(userId: number): Promise<void> {
  await db
    .update(sessions)
    .set({revokedAt: new Date()})
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt
  });
}

export async function requireSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new AppError('SESSION_REQUIRED');

  const [row] = await db
    .select({userId: sessions.userId})
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashSessionToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
        eq(users.isActive, true)
      )
    )
    .limit(1);
  if (!row) throw new AppError('SESSION_REQUIRED');

  return loadPermissionActor(row.userId);
}
