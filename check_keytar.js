async function checkKeytar() {
    try {
        const keytar = require('keytar');
        const SERVICE_NAME = 'AntigravityManager';
        const ACCOUNT_NAME = 'MasterKey';

        const password = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
        console.log('Keytar key exists:', !!password);
        if (password) {
            console.log('Keytar key length:', password.length);
        }

        const credentials = await keytar.findCredentials(SERVICE_NAME);
        console.log('Keytar credentials found:', credentials.length);
    } catch (err) {
        console.error('Keytar error:', err.message);
    }
}

checkKeytar();
