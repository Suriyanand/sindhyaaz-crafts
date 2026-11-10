const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database/gift_shop.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });

const schemaPath = path.join(__dirname, '../database/schema.sql');
if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
}

// Safely ensure migration columns exist
try {
    db.exec('ALTER TABLE orders ADD COLUMN user_id INTEGER');
} catch (e) {
    // Column already exists, safe to ignore
}

module.exports = db;
