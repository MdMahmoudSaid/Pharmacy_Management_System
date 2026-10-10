import {hash} from '@node-rs/argon2';
import {eq} from 'drizzle-orm';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

import {db} from '@/db/client';
import {migrateDatabase} from '@/db/migrate';
import {loginAttempts, sessions, users} from '@/db/schema';
import {
  authenticate,
  hashPin,
  revokeSession
} from '@/modules/auth/service';
import {replaceUserPin} from '@/modules/users/service';
import {createUser, resetDatabase} from '../../factories/database';

describe('authentication', () => {
  beforeAll(migrateDatabase);
  beforeEach(resetDatabase);

  it('authenticates a valid phone and PIN with Argon2id and stores only the token hash', async () => {
    const pinHash = await hashPin('1234');
    const user = await createUser({phoneE164: '+22221234567', pinHash});

    const session = await authenticate('21234567', '1234', 'test-origin-1');
    const stored = await db.select().from(sessions);

    expect(pinHash).toMatch(/^\$argon2id\$/);
    expect(session.user).toMatchObject({id: user.id, phoneE164: '+22221234567'});
    expect(session.token).toHaveLength(43);
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(session.token);
  });

  it('returns the same generic failure for an unknown phone and a wrong PIN', async () => {
    await createUser({
      phoneE164: '+22221234567',
      pinHash: await hash('1234')
    });

    const wrongPin = authenticate('21234567', '9999', 'origin-wrong');
    const unknownPhone = authenticate('31234567', '9999', 'origin-unknown');

    await expect(wrongPin).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
      message: 'AUTHENTICATION_FAILED'
    });
    await expect(unknownPhone).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
      message: 'AUTHENTICATION_FAILED'
    });
  });

  it('denies a disabled user with the generic failure', async () => {
    await createUser({
      phoneE164: '+22221234567',
      pinHash: await hashPin('1234'),
      isActive: false
    });

    await expect(
      authenticate('21234567', '1234', 'origin-disabled')
    ).rejects.toMatchObject({code: 'AUTHENTICATION_FAILED'});
  });

  it('revokes a session by hashing the presented raw token', async () => {
    await createUser({
      phoneE164: '+22221234567',
      pinHash: await hashPin('1234')
    });
    const session = await authenticate('21234567', '1234', 'origin-revoke');

    await revokeSession(session.token);

    const [stored] = await db.select().from(sessions);
    expect(stored.revokedAt).toBeInstanceOf(Date);
  });

  it('revokes active sessions when the PIN is replaced', async () => {
    const user = await createUser({
      phoneE164: '+22221234567',
      pinHash: await hashPin('1234')
    });
    await authenticate('21234567', '1234', 'origin-reset');

    await replaceUserPin(user.id, '5678');

    const [stored] = await db.select().from(sessions);
    const [updatedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));
    expect(stored.revokedAt).toBeInstanceOf(Date);
    await expect(authenticate('21234567', '5678', 'origin-new')).resolves.toBeDefined();
    expect(updatedUser.pinHash).toMatch(/^\$argon2id\$/);
  });

  it('rate limits after five failures without storing raw identifiers or PINs', async () => {
    await createUser({
      phoneE164: '+22221234567',
      pinHash: await hashPin('1234')
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        authenticate('21234567', '9999', 'sensitive-origin')
      ).rejects.toMatchObject({code: 'AUTHENTICATION_FAILED'});
    }
    await expect(
      authenticate('21234567', '1234', 'sensitive-origin')
    ).rejects.toMatchObject({code: 'RATE_LIMITED'});

    const stored = await db.select().from(loginAttempts);
    expect(stored).toHaveLength(5);
    expect(JSON.stringify(stored)).not.toContain('21234567');
    expect(JSON.stringify(stored)).not.toContain('sensitive-origin');
    expect(JSON.stringify(stored)).not.toContain('9999');
  });
});
