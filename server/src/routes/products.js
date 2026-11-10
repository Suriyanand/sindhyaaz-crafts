const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

router.get('/', (req, res) => {
    try {
        const { category, search, featured, active, page = 1, limit = 10, sort } = req.query;
        let query = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND (p.category_id = ? OR c.slug = ?)';
            params.push(category, category);
        }
        if (search) {
            query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (featured !== undefined) {
            query += ' AND p.is_featured = ?';
            params.push(featured === 'true' ? 1 : 0);
        }
        if (active !== undefined) {
            query += ' AND p.is_active = ?';
            params.push(active === 'true' ? 1 : 0);
        }

        if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
        else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
        else if (sort === 'newest') query += ' ORDER BY p.created_at DESC';
        else query += ' ORDER BY p.id DESC';

        const countQuery = `SELECT COUNT(*) as count FROM (${query})`;
        const totalRows = db.prepare(countQuery).get(...params).count;
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const products = db.prepare(query).all(...params);
        
        products.forEach(p => {
            if (typeof p.images === 'string') p.images = JSON.parse(p.images || '[]');
            if (typeof p.variants === 'string') p.variants = JSON.parse(p.variants || '[]');
        });

        res.json({
            success: true,
            data: {
                products,
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

router.get('/:slug', (req, res) => {
    try {
        const product = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?').get(req.params.slug);
        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        if (typeof product.images === 'string') product.images = JSON.parse(product.images || '[]');
        if (typeof product.variants === 'string') product.variants = JSON.parse(product.variants || '[]');
        
        res.json({ success: true, data: product });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/', authenticateToken, (req, res) => {
    try {
        const { name, description, price, compare_price, category_id, images, stock, is_featured, is_active, badge, has_variants, variants } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ success: false, error: 'Name and price are required' });
        }
        
        let slug = slugify(name);
        
        let existing = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }

        const stmt = db.prepare(`
            INSERT INTO products (name, slug, description, price, compare_price, category_id, images, stock, is_featured, is_active, badge, has_variants, variants)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const info = stmt.run(
            name, slug, description, price, compare_price || null, category_id || null, 
            JSON.stringify(images || []), stock || 0, is_featured ? 1 : 0, is_active !== false ? 1 : 0, badge || null, 
            has_variants ? 1 : 0, JSON.stringify(variants || [])
        );

        res.json({ success: true, data: { id: info.lastInsertRowid, slug } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id', authenticateToken, (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, price, compare_price, category_id, images, stock, is_featured, is_active, badge, has_variants, variants } = req.body;
        
        const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        let slug = existing.slug;
        if (name && name !== existing.name) {
            slug = slugify(name);
            let check = db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, id);
            if (check) slug = `${slug}-${Date.now()}`;
        }

        const stmt = db.prepare(`
            UPDATE products SET 
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                description = COALESCE(?, description),
                price = COALESCE(?, price),
                compare_price = ?,
                category_id = COALESCE(?, category_id),
                images = COALESCE(?, images),
                stock = COALESCE(?, stock),
                is_featured = COALESCE(?, is_featured),
                is_active = COALESCE(?, is_active),
                badge = ?,
                has_variants = COALESCE(?, has_variants),
                variants = COALESCE(?, variants)
            WHERE id = ?
        `);

        stmt.run(
            name, slug, description, price, compare_price, category_id,
            images ? JSON.stringify(images) : null, stock, is_featured, is_active,
            badge, has_variants, variants ? JSON.stringify(variants) : null, id
        );

        res.json({ success: true, data: 'Product updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:id', authenticateToken, (req, res) => {
    try {
        db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
        res.json({ success: true, data: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
