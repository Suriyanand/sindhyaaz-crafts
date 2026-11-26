const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }
});

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

async function persistUploadedCategoryImage(file) {
    if (!file) return null;
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;

    await db.run(
        `INSERT INTO uploaded_files (filename, mime_type, data_base64)
         VALUES (?, ?, ?)
         ON CONFLICT(filename) DO UPDATE SET mime_type = excluded.mime_type, data_base64 = excluded.data_base64`,
        [filename, file.mimetype || 'image/jpeg', file.buffer.toString('base64')]
    );

    if (!isServerless) {
        try {
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
            fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
        } catch (e) {}
    }
    return filename;
}

router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT c.*, COUNT(p.id) as product_count
            FROM categories c
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1
        `;
        const params = [];

        if (search) {
            query += ' AND LOWER(c.name) LIKE LOWER(?)';
            params.push(`%${search}%`);
        }

        query += ' GROUP BY c.id ORDER BY c.sort_order ASC, c.id DESC';

        const categories = await db.all(query, params);
        categories.forEach(c => {
            c.id = Number(c.id);
            c.product_count = Number(c.product_count || 0);
        });
        res.json({ success: true, data: categories });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/:slug', async (req, res) => {
    try {
        const category = await db.get('SELECT * FROM categories WHERE slug = ? AND is_active = 1', [req.params.slug]);
        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        const products = await db.all('SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY id DESC', [category.id]);
        products.forEach(p => {
            if (typeof p.images === 'string') {
                try { p.images = JSON.parse(p.images || '[]'); } catch (e) { p.images = []; }
            }
            if (typeof p.variants === 'string') {
                try { p.variants = JSON.parse(p.variants || '[]'); } catch (e) { p.variants = []; }
            }
        });

        res.json({ success: true, data: { category, products } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name, description, sort_order } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        let image = req.body.image || null;
        if (req.file) {
            image = await persistUploadedCategoryImage(req.file);
        }

        let slug = slugify(name) || `category-${Date.now()}`;
        const check = await db.get('SELECT id FROM categories WHERE slug = ?', [slug]);
        if (check) slug = `${slug}-${Date.now()}`;

        const info = await db.run(
            'INSERT INTO categories (name, slug, image, description, sort_order) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), slug, image, description || null, parseInt(sort_order, 10) || 0]
        );

        res.json({ success: true, data: { id: info.lastInsertRowid, slug } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { name, description, sort_order, is_active } = req.body;

        const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        let image = existing.image;
        if (req.file) {
            image = await persistUploadedCategoryImage(req.file);
        } else if (req.body.image === 'null' || req.body.image === '') {
            image = null;
        }

        let slug = existing.slug;
        if (name && name.trim() !== existing.name) {
            slug = slugify(name.trim()) || `category-${id}`;
            const check = await db.get('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, id]);
            if (check) slug = `${slug}-${Date.now()}`;
        }

        await db.run(
            `UPDATE categories SET
                name = ?,
                slug = ?,
                image = ?,
                description = ?,
                sort_order = ?,
                is_active = ?
             WHERE id = ?`,
            [
                name ? name.trim() : existing.name,
                slug,
                image,
                description !== undefined ? description : existing.description,
                sort_order !== undefined && !Number.isNaN(parseInt(sort_order, 10)) ? parseInt(sort_order, 10) : existing.sort_order,
                is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
                id
            ]
        );

        res.json({ success: true, data: 'Category updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await db.run('UPDATE categories SET is_active = 0 WHERE id = ?', [parseInt(req.params.id, 10)]);
        res.json({ success: true, data: 'Category deleted (soft)' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
