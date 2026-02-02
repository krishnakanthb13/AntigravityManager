const { safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');

const keyPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity Manager', '.mk');

async function testDecrypt() {
    try {
        if (!safeStorage.isEncryptionAvailable()) {
            console.log('Encryption NOT available');
            return;
        }
        const encryptedKey = fs.readFileSync(keyPath);
        const hexKey = safeStorage.decryptString(encryptedKey);
        console.log('Decryption SUCCESS');
        console.log('Key length:', hexKey.length);
    } catch (err) {
        console.error('Decryption FAILED:', err.message);
    }
}

testDecrypt();
