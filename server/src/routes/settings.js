const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.get('/', (req, res) => {
    try {
        const settingsList = db.prepare('SELECT key, value FROM site_settings').all();
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

router.put('/', authenticateToken, (req, res) => {
    try {
        const settings = req.body; // Expects an object { key1: value1, key2: value2 }
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid data format' });
        }

        const stmt = db.prepare(`
            INSERT INTO site_settings (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value=excluded.value
        `);
        
        const updateTransaction = db.transaction((settingsObj) => {
            for (const [key, value] of Object.entries(settingsObj)) {
                stmt.run(key, value !== null && value !== undefined ? String(value) : '');
            }
        });

        updateTransaction(settings);
        res.json({ success: true, data: 'Settings updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
