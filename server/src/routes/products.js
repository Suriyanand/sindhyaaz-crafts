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

function normalizeImageList(images) {
    if (!Array.isArray(images)) return [];
    return images
        .filter(Boolean)
        .map(img => {
            const str = String(img).trim();
            if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
                return str;
            }
            return str.replace(/^\/+uploads\/+/, '');
        });
}

function formatProduct(p) {
    if (!p) return p;
    if (typeof p.images === 'string') {
        try { p.images = JSON.parse(p.images || '[]'); } catch (e) { p.images = []; }
    }
    if (!Array.isArray(p.images)) p.images = [];

    if (typeof p.variants === 'string') {
        try { p.variants = JSON.parse(p.variants || '[]'); } catch (e) { p.variants = []; }
    }
    if (!Array.isArray(p.variants)) p.variants = [];

    p.id = Number(p.id);
    p.price = Number(p.price);
    p.compare_price = p.compare_price !== null && p.compare_price !== undefined ? Number(p.compare_price) : null;
    p.stock = Number(p.stock || 0);
    p.is_featured = Number(p.is_featured || 0);
    p.is_active = Number(p.is_active !== undefined ? p.is_active : 1);
    return p;
}

router.get('/', async (req, res) => {
    try {
        const { category, search, featured, active, page = 1, limit = 10, sort } = req.query;
        const parsedLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 10));
        const parsedPage = Math.max(1, parseInt(page, 10) || 1);

        let whereClause = 'WHERE 1=1';
        const params = [];

        if (category) {
            if (/^\d+$/.test(String(category))) {
                whereClause += ' AND p.category_id = ?';
                params.push(parseInt(category, 10));
            } else {
                whereClause += ' AND c.slug = ?';
                params.push(String(category));
            }
        }
        if (search) {
            whereClause += " AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(COALESCE(p.description, '')) LIKE LOWER(?))";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (featured !== undefined && featured !== '') {
            whereClause += ' AND p.is_featured = ?';
            params.push(featured === 'true' || featured === '1' ? 1 : 0);
        }
        if (active !== undefined && active !== '') {
            whereClause += ' AND p.is_active = ?';
            params.push(active === 'true' || active === '1' ? 1 : 0);
        }

        let orderClause = 'ORDER BY p.id DESC';
        if (sort === 'price_asc') orderClause = 'ORDER BY p.price ASC, p.id DESC';
        else if (sort === 'price_desc') orderClause = 'ORDER BY p.price DESC, p.id DESC';
        else if (sort === 'newest') orderClause = 'ORDER BY p.id DESC';

        const countRow = await db.get(
            `SELECT COUNT(*) AS count FROM products p LEFT JOIN categories c ON p.category_id = c.id ${whereClause}`,
            params
        );
        const totalRows = Number(countRow?.count || 0);

        const offset = (parsedPage - 1) * parsedLimit;
        const products = await db.all(
            `SELECT p.*, c.name as category_name, c.slug as category_slug
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             ${whereClause}
             ${orderClause}
             LIMIT ? OFFSET ?`,
            [...params, parsedLimit, offset]
        );

        products.forEach(formatProduct);

        res.json({
            success: true,
            data: {
                products,
                total: totalRows,
                page: parsedPage,
                totalPages: Math.ceil(totalRows / parsedLimit)
            }
        });
    } catch (err) {
        console.error('GET /products error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/:identifier', async (req, res) => {
    try {
        const identifier = req.params.identifier;
        let product;

        if (/^\d+$/.test(identifier)) {
            product = await db.get(
                'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ? OR p.slug = ?',
                [parseInt(identifier, 10), identifier]
            );
        } else {
            product = await db.get(
                'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.slug = ?',
                [identifier]
            );
        }

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        formatProduct(product);
        res.json({ success: true, data: product });
    } catch (err) {
        console.error('GET /products/:identifier error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            name, description, price, compare_price, category_id,
            images, stock, is_featured, is_active, badge, has_variants, variants
        } = req.body;

        const parsedPrice = parseFloat(price);
        if (!name || Number.isNaN(parsedPrice)) {
            return res.status(400).json({ success: false, error: 'Valid name and price are required' });
        }

        let slug = slugify(name) || `product-${Date.now()}`;
        const existing = await db.get('SELECT id FROM products WHERE slug = ?', [slug]);
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }

        const parsedCompare = compare_price !== null && compare_price !== undefined && compare_price !== '' && !Number.isNaN(parseFloat(compare_price))
            ? parseFloat(compare_price)
            : null;
        const parsedCategoryId = category_id !== null && category_id !== undefined && category_id !== '' && !Number.isNaN(parseInt(category_id, 10))
            ? parseInt(category_id, 10)
            : null;
        const parsedStock = Number.isNaN(parseInt(stock, 10)) ? 0 : parseInt(stock, 10);
        const featuredInt = (is_featured === true || is_featured === 1 || is_featured === '1' || is_featured === 'true') ? 1 : 0;
        const activeInt = (is_active === false || is_active === 0 || is_active === '0' || is_active === 'false') ? 0 : 1;
        const hasVariantsInt = (has_variants === true || has_variants === 1) ? 1 : 0;
        const normalizedImages = normalizeImageList(images);

        const info = await db.run(
            `INSERT INTO products (name, slug, description, price, compare_price, category_id, images, stock, is_featured, is_active, badge, has_variants, variants)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name.trim(),
                slug,
                description || '',
                parsedPrice,
                parsedCompare,
                parsedCategoryId,
                JSON.stringify(normalizedImages),
                parsedStock,
                featuredInt,
                activeInt,
                badge || null,
                hasVariantsInt,
                JSON.stringify(Array.isArray(variants) ? variants : [])
            ]
        );

        res.json({ success: true, data: { id: info.lastInsertRowid, slug } });
    } catch (err) {
        console.error('POST /products error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const {
            name, description, price, compare_price, category_id,
            images, stock, is_featured, is_active, badge, has_variants, variants
        } = req.body;

        const existing = await db.get('SELECT * FROM products WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        let slug = existing.slug;
        if (name && name.trim() !== existing.name) {
            slug = slugify(name.trim()) || `product-${id}`;
            const check = await db.get('SELECT id FROM products WHERE slug = ? AND id != ?', [slug, id]);
            if (check) slug = `${slug}-${Date.now()}`;
        }

        const parsedPrice = price !== undefined ? parseFloat(price) : existing.price;
        const parsedCompare = compare_price !== undefined
            ? (compare_price !== null && compare_price !== '' && !Number.isNaN(parseFloat(compare_price)) ? parseFloat(compare_price) : null)
            : existing.compare_price;
        const parsedCategoryId = category_id !== undefined
            ? (category_id !== null && category_id !== '' && !Number.isNaN(parseInt(category_id, 10)) ? parseInt(category_id, 10) : null)
            : existing.category_id;
        const parsedStock = stock !== undefined && !Number.isNaN(parseInt(stock, 10)) ? parseInt(stock, 10) : existing.stock;
        const featuredInt = is_featured !== undefined
            ? ((is_featured === true || is_featured === 1 || is_featured === '1' || is_featured === 'true') ? 1 : 0)
            : existing.is_featured;
        const activeInt = is_active !== undefined
            ? ((is_active === false || is_active === 0 || is_active === '0' || is_active === 'false') ? 0 : 1)
            : existing.is_active;
        const hasVariantsInt = has_variants !== undefined
            ? ((has_variants === true || has_variants === 1) ? 1 : 0)
            : existing.has_variants;

        const finalImages = images !== undefined ? JSON.stringify(normalizeImageList(images)) : existing.images;
        const finalVariants = variants !== undefined ? JSON.stringify(Array.isArray(variants) ? variants : []) : existing.variants;

        await db.run(
            `UPDATE products SET
                name = ?,
                slug = ?,
                description = ?,
                price = ?,
                compare_price = ?,
                category_id = ?,
                images = ?,
                stock = ?,
                is_featured = ?,
                is_active = ?,
                badge = ?,
                has_variants = ?,
                variants = ?
             WHERE id = ?`,
            [
                name ? name.trim() : existing.name,
                slug,
                description !== undefined ? description : existing.description,
                Number.isNaN(parsedPrice) ? existing.price : parsedPrice,
                parsedCompare,
                parsedCategoryId,
                finalImages,
                parsedStock,
                featuredInt,
                activeInt,
                badge !== undefined ? (badge || null) : existing.badge,
                hasVariantsInt,
                finalVariants,
                id
            ]
        );

        res.json({ success: true, data: 'Product updated' });
    } catch (err) {
        console.error('PUT /products/:id error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('DELETE FROM products WHERE id = ?', [parseInt(req.params.id, 10)]);
        res.json({ success: true, data: 'Product deleted' });
    } catch (err) {
        console.error('DELETE /products/:id error:', err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
