import {emitKeypressEvents} from 'node:readline';
import {fileURLToPath} from 'node:url';

import {eq} from 'drizzle-orm';

import {db, pool} from '@/db/client';
import {users} from '@/db/schema';
import {hashPin} from '@/modules/auth/service';
import {normalizeMauritanianPhone, pinSchema} from '@/modules/auth/schemas';
import {syncPermissionCatalog} from '@/modules/permissions/service';

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function promptHidden(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('PIN entry requires an interactive terminal');
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(label);

  return new Promise((resolve, reject) => {
    let value = '';
    const onKeypress = (character: string, key: {name?: string; ctrl?: boolean}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('Cancelled'));
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
      } else if (key.name === 'backspace') {
        value = value.slice(0, -1);
      } else if (/^\d$/.test(character) && value.length < 4) {
        value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off('keypress', onKeypress);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('keypress', onKeypress);
  });
}

export async function createFirstAdmin() {
  if (process.argv.some((value) => value === '--pin' || value.startsWith('--pin='))) {
    throw new Error('PIN arguments are forbidden; enter the PIN interactively');
  }
  const name = argument('name')?.trim();
  const phone = argument('phone');
  if (!name || !phone) {
    throw new Error('Usage: create-admin --name "Name" --phone 21234567');
  }

  const [existing] = await db
    .select({id: users.id})
    .from(users)
    .where(eq(users.role, 'ADMIN'))
    .limit(1);
  if (existing) throw new Error('An administrator already exists');

  const pin = pinSchema.parse(await promptHidden('PIN (4 digits): '));
  await syncPermissionCatalog();
  await db.insert(users).values({
    name,
    phoneE164: normalizeMauritanianPhone(phone),
    pinHash: await hashPin(pin),
    role: 'ADMIN',
    preferredLocale: 'ar'
  });
  process.stdout.write('Administrator created.\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await createFirstAdmin();
  } finally {
    await pool.end();
  }
}
