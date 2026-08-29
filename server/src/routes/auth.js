const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }

        const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        
        res.json({ success: true, data: { token, user: { id: user.id, username: user.username, name: user.name } } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, name, created_at FROM admin_users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        const user = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.user.id);
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!isValid) {
            return res.status(400).json({ success: false, error: 'Incorrect current password' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashed, user.id);
        
        res.json({ success: true, data: 'Password updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
