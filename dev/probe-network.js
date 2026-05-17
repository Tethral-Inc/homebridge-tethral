// Browse for HomeKit-related mDNS services to find the HomePod and other Home Hubs on the LAN
import { Bonjour } from 'bonjour-service';

const bonjour = new Bonjour();
const found = new Map();

function note(kind, service) {
  const key = `${kind}:${service.name}`;
  if (found.has(key)) {
    return;
  }
  found.set(key, true);
  console.log(`[${kind}] ${service.name} @ ${service.host} ${JSON.stringify(service.addresses)} port=${service.port}`);
}

const types = ['hap', 'homekit', 'companion-link', 'airplay', 'raop'];
for (const t of types) {
  const b = bonjour.find({ type: t });
  b.on('up', (s) => note(t, s));
}

setTimeout(() => {
  console.log(`\nTotal unique services across ${types.join(', ')}: ${found.size}`);
  bonjour.destroy();
  process.exit(0);
}, 10000);
