const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', async (req, res) => {
    try {
        const settingsList = await db.all('SELECT key, value FROM site_settings');
        const settings = {};
        settingsList.forEach(s => {
            settings[s.key] = s.value;
        });
        res.json({ success: true, data: settings });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/', authenticateToken, async (req, res) => {
    try {
        const settings = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid data format' });
        }

        for (const [key, value] of Object.entries(settings)) {
            await db.run(
                `INSERT INTO site_settings (key, value)
                 VALUES (?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
                [key, value !== null && value !== undefined ? String(value) : '']
            );
        }

        res.json({ success: true, data: 'Settings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Export full store backup as JSON (admin only)
router.get('/backup', authenticateToken, async (req, res) => {
    try {
        const categories = await db.all('SELECT * FROM categories ORDER BY id ASC');
        const products = await db.all('SELECT * FROM products ORDER BY id ASC');
        const site_settings = await db.all('SELECT * FROM site_settings');
        const orders = await db.all('SELECT * FROM orders ORDER BY id ASC');
        const uploaded_files = await db.all('SELECT * FROM uploaded_files');

        res.json({
            success: true,
            data: {
                exported_at: new Date().toISOString(),
                categories,
                products,
                site_settings,
                orders,
                uploaded_files
            }
        });
    } catch (err) {
        console.error('Backup export error:', err);
        res.status(500).json({ success: false, error: 'Failed to export backup' });
    }
});

module.exports = router;
