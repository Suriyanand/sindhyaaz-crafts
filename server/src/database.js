const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

function resolvePostgresUrl() {
    if (process.env.NETLIFY_DB_URL && process.env.NETLIFY_DB_URL.trim()) {
        return process.env.NETLIFY_DB_URL.trim();
    }
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
        return process.env.DATABASE_URL.trim();
    }
    try {
        const { getConnectionString } = require('@netlify/database');
        const conn = getConnectionString();
        if (conn && String(conn).trim()) return String(conn).trim();
    } catch (e) {}
    return '';
}

const bundledDbPath = path.join(__dirname, '../database/gift_shop.db');
const dbPath = process.env.DATABASE_PATH || bundledDbPath;

let sqlite = null;
let pgPool = null;
let initPromise = null;

function sanitizeParam(val) {
    if (val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'number' && Number.isNaN(val)) return null;
    return val;
}

function toPgParams(sql, params = []) {
    let idx = 0;
    let inSingleQuote = false;
    let out = '';
    for (let i = 0; i < sql.length; i++) {
        const ch = sql[i];
        if (ch === "'" && sql[i - 1] !== '\\') {
            inSingleQuote = !inSingleQuote;
            out += ch;
        } else if (ch === '?' && !inSingleQuote) {
            idx++;
            out += `$${idx}`;
        } else {
            out += ch;
        }
    }
    return { text: out, values: params.map(sanitizeParam) };
}

function shouldReturnId(sql) {
    const trimmed = sql.trim();
    if (!/^INSERT\s+INTO\s+/i.test(trimmed)) return false;
    if (/RETURNING\s+/i.test(trimmed)) return false;
    if (/^INSERT\s+(OR\s+IGNORE\s+)?INTO\s+(site_settings|uploaded_files)\b/i.test(trimmed)) {
        return false;
    }
    return true;
}

async function seedPostgresFromJson(pool) {
    const { rows: prodCountRows } = await pool.query('SELECT COUNT(*) AS count FROM products');
    const { rows: adminCountRows } = await pool.query('SELECT COUNT(*) AS count FROM admin_users');
    const prodCount = Number(prodCountRows[0]?.count || 0);
    const adminCount = Number(adminCountRows[0]?.count || 0);

    if (prodCount > 0 && adminCount > 0) {
        return;
    }

    let seedData;
    try {
        seedData = require('../database/seed-data.json');
    } catch (e) {
        console.warn('No seed-data.json available for PostgreSQL bootstrap:', e.message);
        return;
    }

    console.log('Bootstrapping PostgreSQL database from bundled seed-data.json...');

    if (adminCount === 0 && Array.isArray(seedData.admin_users)) {
        for (const a of seedData.admin_users) {
            await pool.query(
                `INSERT INTO admin_users (id, username, password_hash, name, created_at)
                 VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING`,
                [a.id, a.username, a.password_hash, a.name, a.created_at]
            );
        }
    }

    const catCountRows = (await pool.query('SELECT COUNT(*) AS count FROM categories')).rows;
    if (Number(catCountRows[0]?.count || 0) === 0 && Array.isArray(seedData.categories)) {
        for (const c of seedData.categories) {
            await pool.query(
                `INSERT INTO categories (id, name, slug, image, description, sort_order, is_active, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
                [c.id, c.name, c.slug, c.image, c.description, c.sort_order ?? 0, c.is_active ?? 1, c.created_at]
            );
        }
    }

    if (prodCount === 0 && Array.isArray(seedData.products)) {
        for (const p of seedData.products) {
            await pool.query(
                `INSERT INTO products (id, name, slug, description, price, compare_price, category_id, images, stock, is_featured, is_active, badge, has_variants, variants, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
                [
                    p.id, p.name, p.slug, p.description, p.price, p.compare_price, p.category_id,
                    typeof p.images === 'string' ? p.images : JSON.stringify(p.images || []),
                    p.stock ?? 0, p.is_featured ?? 0, p.is_active ?? 1,
                    p.badge, p.has_variants ?? 0,
                    typeof p.variants === 'string' ? p.variants : JSON.stringify(p.variants || []),
                    p.created_at
                ]
            );
        }
    }

    if (Array.isArray(seedData.site_settings)) {
        for (const s of seedData.site_settings) {
            await pool.query(
                `INSERT INTO site_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
                [s.key, s.value]
            );
        }
    }

    for (const table of ['admin_users', 'categories', 'products', 'orders', 'users']) {
        await pool.query(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`
        );
    }
    console.log('PostgreSQL bootstrap completed cleanly.');
}

async function initPostgres(connStr) {
    const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');
    const useSsl = process.env.DATABASE_SSL === 'false' ? false : (!isLocal ? { rejectUnauthorized: false } : false);

    pgPool = new Pool({
        connectionString: connStr,
        ssl: useSsl,
        max: 10,
        idleTimeoutMillis: 30000
    });

    await pgPool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            image TEXT,
            description TEXT,
            sort_order INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            description TEXT,
            price DOUBLE PRECISION NOT NULL,
            compare_price DOUBLE PRECISION,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            images TEXT DEFAULT '[]',
            stock INTEGER DEFAULT 0,
            is_featured INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            badge TEXT,
            has_variants INTEGER DEFAULT 0,
            variants TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS orders (
            id SERIAL PRIMARY KEY,
            order_number TEXT UNIQUE,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            address TEXT NOT NULL,
            city TEXT,
            state TEXT,
            pincode TEXT NOT NULL,
            items TEXT NOT NULL,
            subtotal DOUBLE PRECISION,
            shipping DOUBLE PRECISION DEFAULT 0,
            total DOUBLE PRECISION NOT NULL,
            payment_id TEXT,
            payment_order_id TEXT,
            payment_status TEXT DEFAULT 'pending',
            order_status TEXT DEFAULT 'pending',
            tracking_number TEXT,
            courier_name TEXT,
            notes TEXT,
            user_id INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS admin_users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS site_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            phone TEXT,
            avatar TEXT,
            auth_provider TEXT DEFAULT 'local',
            google_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS uploaded_files (
            filename TEXT PRIMARY KEY,
            mime_type TEXT NOT NULL,
            data_base64 TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pgPool.query(
        `INSERT INTO site_settings (key, value) VALUES ('upi_id', '8098587377@upi') ON CONFLICT (key) DO NOTHING`
    );

    await seedPostgresFromJson(pgPool);
    console.log('Connected to PostgreSQL database (persistent storage active).');
}

function initSqlite() {
    // Lazy require so Netlify Linux Lambdas running PostgreSQL never load native SQLite addons
    const Database = require('better-sqlite3');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    if (path.resolve(dbPath) !== path.resolve(bundledDbPath) && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
        fs.copyFileSync(bundledDbPath, dbPath);
    }

    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    const schemaPath = path.join(__dirname, '../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
        sqlite.exec(fs.readFileSync(schemaPath, 'utf8'));
    }

    const alterStatements = [
        'ALTER TABLE orders ADD COLUMN user_id INTEGER',
        'ALTER TABLE orders ADD COLUMN tracking_number TEXT',
        'ALTER TABLE orders ADD COLUMN courier_name TEXT'
    ];
    for (const stmt of alterStatements) {
        try { sqlite.exec(stmt); } catch (e) {}
    }

    try {
        sqlite.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').run('upi_id', '8098587377@upi');
    } catch (e) {}

    console.log(`Connected to SQLite database at ${dbPath}`);
}

const db = {
    get isPostgres() {
        return Boolean(resolvePostgresUrl());
    },

    isPersistent() {
        if (this.isPostgres) return true;
        if (!process.env.RENDER && !process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
        if (process.env.PERSISTENT_STORAGE === 'true') return true;
        const resolved = path.resolve(dbPath);
        return resolved.startsWith('/var/data') || resolved.startsWith('/data');
    },

    getStorageInfo() {
        return {
            engine: this.isPostgres ? 'postgresql' : 'sqlite',
            persistent: this.isPersistent(),
            dbPath: this.isPostgres ? 'PostgreSQL (Netlify DB / DATABASE_URL)' : dbPath
        };
    },

    async init() {
        if (!initPromise) {
            initPromise = (async () => {
                const pgUrl = resolvePostgresUrl();
                if (pgUrl) {
                    await initPostgres(pgUrl);
                } else {
                    initSqlite();
                }
            })().catch(err => {
                initPromise = null;
                throw err;
            });
        }
        return initPromise;
    },

    async get(sql, params = []) {
        await this.init();
        if (pgPool) {
            const { text, values } = toPgParams(sql, params);
            const res = await pgPool.query(text, values);
            return res.rows[0];
        } else {
            return sqlite.prepare(sql).get(...params.map(sanitizeParam));
        }
    },

    async all(sql, params = []) {
        await this.init();
        if (pgPool) {
            const { text, values } = toPgParams(sql, params);
            const res = await pgPool.query(text, values);
            return res.rows;
        } else {
            return sqlite.prepare(sql).all(...params.map(sanitizeParam));
        }
    },

    async run(sql, params = []) {
        await this.init();
        if (pgPool) {
            let finalSql = sql;
            if (shouldReturnId(finalSql)) {
                finalSql = `${finalSql.trim().replace(/;$/, '')} RETURNING id`;
            }
            const { text, values } = toPgParams(finalSql, params);
            const res = await pgPool.query(text, values);
            return {
                lastInsertRowid: res.rows?.[0]?.id ?? null,
                changes: res.rowCount
            };
        } else {
            const info = sqlite.prepare(sql).run(...params.map(sanitizeParam));
            return {
                lastInsertRowid: info.lastInsertRowid,
                changes: info.changes
            };
        }
    },

    async exec(sql) {
        await this.init();
        if (pgPool) {
            await pgPool.query(sql);
        } else {
            sqlite.exec(sql);
        }
    },

    async close() {
        if (pgPool) await pgPool.end();
        if (sqlite) sqlite.close();
    }
};

module.exports = db;
