const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

router.get('/stats', authenticateToken, (req, res) => {
    try {
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;
        const totalCategories = db.prepare('SELECT COUNT(*) as count FROM categories WHERE is_active = 1').get().count;
        const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
        const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE order_status = 'pending'").get().count;
        
        const revenueResult = db.prepare("SELECT SUM(total) as sum FROM orders WHERE payment_status = 'paid' OR payment_status = 'success'").get();
        const totalRevenue = revenueResult.sum || 0;
        
        const lowStockProducts = db.prepare('SELECT id, name, stock FROM products WHERE stock < 5 AND is_active = 1 ORDER BY stock ASC').all();
        
        const recentOrders = db.prepare('SELECT id, order_number, customer_name, total, order_status, created_at FROM orders ORDER BY id DESC LIMIT 10').all();

        res.json({
            success: true,
            data: {
                total_products: totalProducts,
                total_categories: totalCategories,
                total_orders: totalOrders,
                pending_orders: pendingOrders,
                total_revenue: totalRevenue,
                low_stock_products: lowStockProducts,
                recent_orders: recentOrders
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
