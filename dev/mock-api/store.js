import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const here = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(here, 'store.json');

const SEED_USER_ID = 'usr_dev_seed';
const SEED_ROUTINES = [
  { id: 'rt_morning', name: 'Good Morning', description: 'Lights on, blinds open, kitchen scene' },
  { id: 'rt_movie', name: 'Movie Night', description: 'Dim living room, TV mode on accent lights' },
  { id: 'rt_away', name: 'Leaving Home', description: 'Lock doors, lights off, arm security' },
];

function defaultStore() {
  return {
    tokens: {},
    users: {
      [SEED_USER_ID]: {
        id: SEED_USER_ID,
        email: 'dev@tethral.local',
        routines: SEED_ROUTINES.map(r => ({ ...r, owner_user_id: SEED_USER_ID, created_at: new Date().toISOString() })),
      },
    },
    executions: [],
  };
}

export function saveStore(store) {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

export function loadStore() {
  if (!existsSync(STORE_PATH)) {
    const fresh = defaultStore();
    saveStore(fresh);
    return fresh;
  }
  return JSON.parse(readFileSync(STORE_PATH, 'utf8'));
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken() {
  return 'tth_' + randomBytes(32).toString('base64url');
}

export function mintToken(store, { userId = SEED_USER_ID, name = 'homebridge' } = {}) {
  const plaintext = generateToken();
  const hash = hashToken(plaintext);
  store.tokens[hash] = {
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
  };
  saveStore(store);
  return plaintext;
}

export function resolveToken(store, plaintext) {
  if (!plaintext || !plaintext.startsWith('tth_')) {
    return null;
  }
  const hash = hashToken(plaintext);
  const record = store.tokens[hash];
  if (!record || record.revoked_at) {
    return null;
  }
  record.last_used_at = new Date().toISOString();
  saveStore(store);
  return record;
}

export function routinesForUser(store, userId) {
  return store.users[userId]?.routines ?? [];
}

export function recordExecution(store, { userId, routineId }) {
  store.executions.push({
    id: 'exe_' + randomBytes(8).toString('base64url'),
    user_id: userId,
    routine_id: routineId,
    fired_at: new Date().toISOString(),
  });
  saveStore(store);
}

export { SEED_USER_ID };
