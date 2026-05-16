import { loadStore, mintToken, SEED_USER_ID } from './store.js';

const args = process.argv.slice(2);
const userId = args[0] ?? SEED_USER_ID;
const name = args[1] ?? 'homebridge';

const store = loadStore();
const token = mintToken(store, { userId, name });

console.log('');
console.log('  Tethral API token minted (mock).');
console.log('  ----------------------------------------------------------------');
console.log('  user_id : ' + userId);
console.log('  name    : ' + name);
console.log('  token   : ' + token);
console.log('  ----------------------------------------------------------------');
console.log('  Paste this token into test/hbConfig/config.json as apiToken,');
console.log('  or into the Homebridge UI for the Tethral plugin.');
console.log('  This is the only time the plaintext token is shown.');
console.log('');
