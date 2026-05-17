import { Bonjour } from 'bonjour-service';

const bonjour = new Bonjour();
const found = [];
const browser = bonjour.find({ type: 'hap' });

browser.on('up', (service) => {
  found.push({
    name: service.name,
    host: service.host,
    fqdn: service.fqdn,
    port: service.port,
    addresses: service.addresses,
    txt: service.txt,
  });
  console.log('FOUND:', JSON.stringify(found[found.length - 1], null, 2));
});

browser.on('down', (service) => {
  console.log('DOWN:', service.name);
});

console.log('Browsing for _hap._tcp.local services for 8 seconds...');
setTimeout(() => {
  console.log(`\nTotal HAP services discovered: ${found.length}`);
  if (found.length === 0) {
    console.log('NO HAP services found via mDNS on this network.');
    console.log('This means Homebridge mDNS announcements are not reaching even this laptop.');
  }
  bonjour.destroy();
  process.exit(0);
}, 8000);
