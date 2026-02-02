const Database = require('better-sqlite3');
const db = new Database('test.db');

try {
    const rows = db.prepare('SELECT id, email, token FROM cloud_accounts LIMIT 5').all();
    console.log(JSON.stringify(rows, null, 2));
} catch (err) {
    console.error(err);
} finally {
    db.close();
}
