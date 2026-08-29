const express = require('express');
const router = express.Router();
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

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
        const categories = db.prepare(`
            SELECT c.*, COUNT(p.id) as product_count 
            FROM categories c 
            LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
            WHERE c.is_active = 1 
            GROUP BY c.id 
            ORDER BY c.sort_order ASC, c.id DESC
        `).all();
        res.json({ success: true, data: categories });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.get('/:slug', (req, res) => {
    try {
        const category = db.prepare('SELECT * FROM categories WHERE slug = ? AND is_active = 1').get(req.params.slug);
        if (!category) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }
        
        const products = db.prepare('SELECT * FROM products WHERE category_id = ? AND is_active = 1 ORDER BY id DESC').all(category.id);
        products.forEach(p => {
            if (typeof p.images === 'string') p.images = JSON.parse(p.images || '[]');
            if (typeof p.variants === 'string') p.variants = JSON.parse(p.variants || '[]');
        });
        
        res.json({ success: true, data: { category, products } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.post('/', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const { name, description, sort_order } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }

        let image = req.body.image || null;
        if (req.file) {
            image = req.file.filename;
        }

        let slug = slugify(name);
        let check = db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug);
        if (check) slug = `${slug}-${Date.now()}`;

        const info = db.prepare('INSERT INTO categories (name, slug, image, description, sort_order) VALUES (?, ?, ?, ?, ?)').run(
            name, slug, image, description || null, sort_order || 0
        );
        
        res.json({ success: true, data: { id: info.lastInsertRowid, slug } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.put('/:id', authenticateToken, upload.single('image'), (req, res) => {
    try {
        const id = req.params.id;
        const { name, description, sort_order, is_active } = req.body;
        
        const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Category not found' });
        }

        let image = existing.image;
        if (req.file) {
            image = req.file.filename;
        } else if (req.body.image === 'null' || req.body.image === '') {
            image = null;
        }

        let slug = existing.slug;
        if (name && name !== existing.name) {
            slug = slugify(name);
            let check = db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id);
            if (check) slug = `${slug}-${Date.now()}`;
        }

        db.prepare(`
            UPDATE categories SET 
                name = COALESCE(?, name),
                slug = COALESCE(?, slug),
                image = ?,
                description = ?,
                sort_order = COALESCE(?, sort_order),
                is_active = COALESCE(?, is_active)
            WHERE id = ?
        `).run(name, slug, image, description, sort_order, is_active, id);

        res.json({ success: true, data: 'Category updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:id', authenticateToken, (req, res) => {
    try {
        db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(req.params.id);
        res.json({ success: true, data: 'Category deleted (soft)' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
