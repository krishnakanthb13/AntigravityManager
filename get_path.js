const os = require('os');
const path = require('path');
const appName = 'antigravity-manager'; // From package.json name

// Electron's default userData on Windows
const userData = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity Manager');
console.log(userData);
