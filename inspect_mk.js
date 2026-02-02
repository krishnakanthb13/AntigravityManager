const fs = require('fs');
const path = require('path');
const os = require('os');

const keyPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity Manager', '.mk');

try {
    const content = fs.readFileSync(keyPath);
    console.log('File size:', content.length);
    console.log('Is Hex (64 chars):', content.length === 64 && /^[a-f0-9]+$/i.test(content.toString('utf8')));
    console.log('First 10 bytes (hex):', content.slice(0, 10).toString('hex'));
} catch (err) {
    console.error(err);
}
