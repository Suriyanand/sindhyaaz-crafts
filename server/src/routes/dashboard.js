const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const totalProducts = Number((await db.get('SELECT COUNT(*) as count FROM products WHERE is_active = 1'))?.count || 0);
        const totalCategories = Number((await db.get('SELECT COUNT(*) as count FROM categories WHERE is_active = 1'))?.count || 0);
        const totalOrders = Number((await db.get('SELECT COUNT(*) as count FROM orders'))?.count || 0);
        const pendingOrders = Number((await db.get("SELECT COUNT(*) as count FROM orders WHERE LOWER(order_status) = 'pending'"))?.count || 0);

        const revenueResult = await db.get("SELECT SUM(total) as sum FROM orders WHERE LOWER(payment_status) LIKE 'paid%' OR LOWER(payment_status) = 'success'");
        const totalRevenue = Number(revenueResult?.sum || 0);

        const lowStockProducts = await db.all('SELECT id, name, stock FROM products WHERE stock < 5 AND is_active = 1 ORDER BY stock ASC');

        const recentOrders = await db.all('SELECT id, order_number, customer_name, phone, total, order_status, created_at FROM orders ORDER BY id DESC LIMIT 10');

        res.json({
            success: true,
            data: {
                total_products: totalProducts,
                total_categories: totalCategories,
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                total_revenue: totalRevenue,
                low_stock_products: lowStockProducts,
                recent_orders: recentOrders,
                storage: db.getStorageInfo()
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
