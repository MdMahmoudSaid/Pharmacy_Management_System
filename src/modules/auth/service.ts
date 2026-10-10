import {createHmac} from 'node:crypto';

import {hash, verify} from '@node-rs/argon2';
import {and, eq, gte, or} from 'drizzle-orm';

import {db} from '@/db/client';
import {loginAttempts, users} from '@/db/schema';
import {AppError} from '@/lib/errors';
import {normalizeMauritanianPhone, pinSchema} from './schemas';
import {createSession} from './session';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const fingerprintSecret =
  process.env.AUTH_FINGERPRINT_SECRET ?? 'development-only-change-me';
const argonOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32
};
let dummyHash: Promise<string> | undefined;

const fingerprint = (value: string) =>
  createHmac('sha256', fingerprintSecret).update(value).digest('hex');

export const hashPin = (pin: string) => hash(pinSchema.parse(pin), argonOptions);

export type SessionView = {
  token: string;
  expiresAt: Date;
  user: {
    id: number;
    name: string;
    phoneE164: string;
    role: 'ADMIN' | 'EMPLOYEE';
    preferredLocale: 'ar' | 'fr';
  };
};

export async function authenticate(
  localPhone: string,
  pin: string,
  origin: string
): Promise<SessionView> {
  let phoneE164: string;
  try {
    phoneE164 = normalizeMauritanianPhone(localPhone);
    pinSchema.parse(pin);
  } catch {
    throw new AppError('AUTHENTICATION_FAILED');
  }

  const phoneFingerprint = fingerprint(phoneE164);
  const originFingerprint = fingerprint(origin);
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const recentFailures = await db
    .select({
      phoneFingerprint: loginAttempts.phoneFingerprint,
      originFingerprint: loginAttempts.originFingerprint
    })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.success, false),
        gte(loginAttempts.attemptedAt, since),
        or(
          eq(loginAttempts.phoneFingerprint, phoneFingerprint),
          eq(loginAttempts.originFingerprint, originFingerprint)
        )
      )
    );
  const phoneFailures = recentFailures.filter(
    (attempt) => attempt.phoneFingerprint === phoneFingerprint
  ).length;
  const originFailures = recentFailures.filter(
    (attempt) => attempt.originFingerprint === originFingerprint
  ).length;
  if (
    phoneFailures >= MAX_FAILED_ATTEMPTS ||
    originFailures >= MAX_FAILED_ATTEMPTS
  ) {
    throw new AppError('RATE_LIMITED');
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.phoneE164, phoneE164))
    .limit(1);
  dummyHash ??= hash('0000', argonOptions);
  const validPin = await verify(user?.pinHash ?? (await dummyHash), pin);
  const successful = Boolean(user?.isActive && validPin);

  await db.insert(loginAttempts).values({
    phoneFingerprint,
    originFingerprint,
    success: successful
  });

  if (!successful || !user) throw new AppError('AUTHENTICATION_FAILED');

  const session = await createSession(user.id);
  return {
    ...session,
    user: {
      id: user.id,
      name: user.name,
      phoneE164: user.phoneE164,
      role: user.role,
      preferredLocale: user.preferredLocale
    }
  };
}

export {revokeSession, revokeUserSessions} from './session';
