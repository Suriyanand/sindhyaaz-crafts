const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Customer Registration
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, error: 'Name, email, and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existing = await db.get('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing) {
            return res.status(400).json({ success: false, error: 'An account with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const info = await db.run(
            `INSERT INTO users (name, email, password_hash, phone, auth_provider)
             VALUES (?, ?, ?, ?, 'local')`,
            [name.trim(), normalizedEmail, password_hash, phone ? phone.trim() : null]
        );

        const token = jwt.sign(
            { id: info.lastInsertRowid, email: normalizedEmail, name: name.trim(), role: 'customer' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: info.lastInsertRowid,
                    name: name.trim(),
                    email: normalizedEmail,
                    phone: phone ? phone.trim() : null
                }
            }
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ success: false, error: 'Failed to create account. Please try again.' });
    }
});

// Customer Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        if (user.auth_provider === 'google' && !user.password_hash) {
            return res.status(400).json({ success: false, error: 'This account was signed up with Google. Please use Google Login.' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: 'customer' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                }
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
});

// Third-Party / Google Login
router.post('/google-login', async (req, res) => {
    try {
        let { name, email, google_id, avatar, credential } = req.body;

        if (credential && (!email || !google_id)) {
            try {
                const payloadBase64 = credential.split('.')[1];
                const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
                if (decoded.email) email = decoded.email;
                if (decoded.name) name = decoded.name;
                if (decoded.sub) google_id = decoded.sub;
                if (decoded.picture) avatar = decoded.picture;
            } catch (decErr) {
                console.warn('Could not decode credential JWT:', decErr);
            }
        }

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required for Google Sign-in' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        let user = await db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

        if (!user) {
            const info = await db.run(
                `INSERT INTO users (name, email, google_id, avatar, auth_provider)
                 VALUES (?, ?, ?, ?, 'google')`,
                [name || normalizedEmail.split('@')[0], normalizedEmail, google_id || null, avatar || null]
            );
            user = {
                id: info.lastInsertRowid,
                name: name || normalizedEmail.split('@')[0],
                email: normalizedEmail,
                avatar: avatar || null
            };
        } else if (!user.google_id && google_id) {
            await db.run(
                'UPDATE users SET google_id = ?, avatar = COALESCE(avatar, ?) WHERE id = ?',
                [google_id, avatar || null, user.id]
            );
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: 'customer' },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    avatar: user.avatar
                }
            }
        });
    } catch (err) {
        console.error('Google login error:', err);
        res.status(500).json({ success: false, error: 'Google sign-in failed' });
    }
});

// Get Current User Profile
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await db.get('SELECT id, name, email, phone, avatar, auth_provider, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        res.json({ success: true, data: user });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Get Current User's Orders
router.get('/orders', authenticateToken, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const userId = req.user.id;

        const orders = await db.all(
            `SELECT * FROM orders
             WHERE user_id = ? OR LOWER(email) = LOWER(?)
             ORDER BY id DESC`,
            [userId, userEmail]
        );

        orders.forEach(o => {
            if (typeof o.items === 'string') {
                try { o.items = JSON.parse(o.items || '[]'); } catch (e) { o.items = []; }
            }
        });

        res.json({ success: true, data: orders });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to retrieve orders' });
    }
});

// Public Track Order Endpoint
router.post('/track-order', async (req, res) => {
    try {
        const { order_number, phone } = req.body;
        if (!order_number) {
            return res.status(400).json({ success: false, error: 'Order number is required' });
        }

        let query = 'SELECT * FROM orders WHERE UPPER(order_number) = UPPER(?)';
        const params = [order_number.trim()];

        if (phone) {
            query += ' AND phone LIKE ?';
            params.push(`%${phone.trim()}%`);
        }

        const order = await db.get(query, params);
        if (!order) {
            return res.status(404).json({ success: false, error: 'No order found with the provided details' });
        }

        if (typeof order.items === 'string') {
            try { order.items = JSON.parse(order.items || '[]'); } catch (e) { order.items = []; }
        }

        res.json({
            success: true,
            data: {
                order_number: order.order_number,
                customer_name: order.customer_name,
                created_at: order.created_at,
                order_status: order.order_status,
                payment_status: order.payment_status,
                payment_id: order.payment_id,
                tracking_number: order.tracking_number,
                courier_name: order.courier_name,
                total: order.total,
                subtotal: order.subtotal,
                shipping: order.shipping,
                items: order.items,
                city: order.city,
                state: order.state
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Tracking lookup failed' });
    }
});

module.exports = router;
