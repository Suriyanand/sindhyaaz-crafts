const express = require('express');
const router = express.Router();
const db = require('../database');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

function generateOrderNumber() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GL-${dateStr}-${randomStr}`;
}

router.post('/', async (req, res) => {
    try {
        let {
            customer_name, phone, email, address, city, state, pincode,
            items, subtotal, shipping, total, payment_id, payment_order_id,
            payment_status, notes, customer, totalAmount, user_id
        } = req.body;

        if (customer && typeof customer === 'object') {
            customer_name = customer_name || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name;
            phone = phone || customer.phone;
            email = email || customer.email;
            address = address || `${customer.address1 || customer.address || ''} ${customer.address2 || ''}`.trim();
            city = city || customer.city;
            state = state || customer.state;
            pincode = pincode || customer.pincode;
            notes = notes || customer.notes;
        }

        total = total !== undefined ? total : totalAmount;
        if (subtotal === undefined && total !== undefined) {
            subtotal = Number(total) - Number(shipping || 0);
        }

        if (!user_id && req.headers['authorization']) {
            try {
                const token = req.headers['authorization'].split(' ')[1];
                if (token) {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded && decoded.id) user_id = decoded.id;
                }
            } catch (e) {}
        }

        if (!customer_name || !phone || !address || !pincode || !items || total === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: customer_name, phone, address, pincode, items, and total are required'
            });
        }

        const order_number = generateOrderNumber();

        const info = await db.run(
            `INSERT INTO orders (order_number, customer_name, phone, email, address, city, state, pincode, items, subtotal, shipping, total, payment_id, payment_order_id, payment_status, notes, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_number, customer_name, phone, email || null, address, city || null, state || null, pincode,
                typeof items === 'string' ? items : JSON.stringify(items),
                Number(subtotal || 0), Number(shipping || 0), Number(total),
                payment_id || null, payment_order_id || null, payment_status || 'pending',
                notes || null, user_id ? parseInt(user_id, 10) : null
            ]
        );

        res.json({
            success: true,
            data: {
                id: info.lastInsertRowid,
                order_number,
                total: Number(total),
                status: 'pending'
            }
        });
    } catch (err) {
        console.error('Order creation error:', err);
        res.status(500).json({ success: false, error: 'Internal server error while creating order' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, date_from, date_to, search, page = 1, limit = 50 } = req.query;
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            if (status.toLowerCase() === 'processing' || status.toLowerCase() === 'confirmed') {
                whereClause += " AND (LOWER(order_status) = 'processing' OR LOWER(order_status) = 'confirmed')";
            } else {
                whereClause += ' AND LOWER(order_status) = LOWER(?)';
                params.push(status);
            }
        }
        if (date_from) {
            whereClause += ' AND created_at >= ?';
            params.push(date_from);
        }
        if (date_to) {
            whereClause += ' AND created_at <= ?';
            params.push(date_to + ' 23:59:59');
        }
        if (search) {
            whereClause += ' AND (LOWER(order_number) LIKE LOWER(?) OR LOWER(customer_name) LIKE LOWER(?) OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const totalRows = Number((await db.get(`SELECT COUNT(*) as count FROM orders ${whereClause}`, params))?.count || 0);

        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const orders = await db.all(
            `SELECT * FROM orders ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
            [...params, parsedLimit, offset]
        );
        orders.forEach(o => {
            if (typeof o.items === 'string') {
                try { o.items = JSON.parse(o.items || '[]'); } catch (e) { o.items = []; }
            }
        });

        res.json({
            success: true,
            data: {
                orders,
                total: totalRows,
                page: parsedPage,
                totalPages: Math.ceil(totalRows / parsedLimit)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [parseInt(req.params.id, 10)]);
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        if (typeof order.items === 'string') {
            try { order.items = JSON.parse(order.items || '[]'); } catch (e) { order.items = []; }
        }
        res.json({ success: true, data: order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id/status', authenticateToken, async (req, res) => {
    try {
        const order_status = req.body.order_status || req.body.status;
        const tracking_number = req.body.tracking_number;
        const courier_name = req.body.courier_name;
        const payment_status = req.body.payment_status;

        if (!order_status && !payment_status) {
            return res.status(400).json({ success: false, error: 'order_status or payment_status is required' });
        }

        const sets = [];
        const params = [];

        if (order_status) {
            sets.push('order_status = ?');
            params.push(order_status);
        }
        if (payment_status) {
            sets.push('payment_status = ?');
            params.push(payment_status);
        }
        if (tracking_number !== undefined) {
            sets.push('tracking_number = ?');
            params.push(tracking_number);
        }
        if (courier_name !== undefined) {
            sets.push('courier_name = ?');
            params.push(courier_name);
        }

        const query = `UPDATE orders SET ${sets.join(', ')} WHERE id = ?`;
        params.push(parseInt(req.params.id, 10));

        await db.run(query, params);
        res.json({ success: true, data: 'Order updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
