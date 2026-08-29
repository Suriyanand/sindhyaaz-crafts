const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

function generateOrderNumber() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GL-${dateStr}-${randomStr}`;
}

router.post('/', (req, res) => {
    try {
        const { customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, total, payment_id, payment_order_id, payment_status, notes } = req.body;
        
        if (!customer_name || !phone || !address || !pincode || !items || total === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const order_number = generateOrderNumber();
        
        const info = db.prepare(`
            INSERT INTO orders (order_number, customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, total, payment_id, payment_order_id, payment_status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            order_number, customer_name, phone, email || null, address, city || null, state || null, pincode,
            typeof items === 'string' ? items : JSON.stringify(items),
            subtotal || 0, shipping || 0, total, payment_id || null, payment_order_id || null, payment_status || 'pending', notes || null
        );

        res.json({ success: true, data: { id: info.lastInsertRowid, order_number } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/', authenticateToken, (req, res) => {
    try {
        const { status, date_from, date_to, search, page = 1, limit = 20 } = req.query;
        let query = 'SELECT * FROM orders WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND order_status = ?';
            params.push(status);
        }
        if (date_from) {
            query += ' AND created_at >= ?';
            params.push(date_from);
        }
        if (date_to) {
            query += ' AND created_at <= ?';
            params.push(date_to + ' 23:59:59');
        }
        if (search) {
            query += ' AND (order_number LIKE ? OR customer_name LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const countQuery = `SELECT COUNT(*) as count FROM (${query})`;
        const totalRows = db.prepare(countQuery).get(...params).count;

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        const offset = (parseInt(page) - 1) * parseInt(limit);
        params.push(parseInt(limit), offset);

        const orders = db.prepare(query).all(...params);
        orders.forEach(o => {
            if (typeof o.items === 'string') o.items = JSON.parse(o.items || '[]');
        });

        res.json({
            success: true,
            data: {
                orders,
                total: totalRows,
                page: parseInt(page),
                totalPages: Math.ceil(totalRows / parseInt(limit))
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/:id', authenticateToken, (req, res) => {
    try {
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (typeof order.items === 'string') order.items = JSON.parse(order.items || '[]');
        res.json({ success: true, data: order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id/status', authenticateToken, (req, res) => {
    try {
        const { order_status } = req.body;
        if (!order_status) {
            return res.status(400).json({ success: false, error: 'order_status is required' });
        }
        
        db.prepare('UPDATE orders SET order_status = ? WHERE id = ?').run(order_status, req.params.id);
        res.json({ success: true, data: 'Order status updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
