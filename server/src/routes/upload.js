const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpg, jpeg, png, gif, webp)'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

router.post('/', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        // Persist image binary inside the database so uploads survive ephemeral container restarts
        for (const file of req.files) {
            try {
                const buffer = fs.readFileSync(file.path);
                const base64 = buffer.toString('base64');
                await db.run(
                    `INSERT INTO uploaded_files (filename, mime_type, data_base64)
                     VALUES (?, ?, ?)
                     ON CONFLICT(filename) DO UPDATE SET mime_type = excluded.mime_type, data_base64 = excluded.data_base64`,
                    [file.filename, file.mimetype || 'image/jpeg', base64]
                );
            } catch (dbErr) {
                console.warn(`Failed to persist uploaded file ${file.filename} to DB:`, dbErr.message);
            }
        }

        const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ success: true, data: fileUrls });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:filename', authenticateToken, async (req, res) => {
    try {
        const filename = req.params.filename;
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }

        await db.run('DELETE FROM uploaded_files WHERE filename = ?', [filename]);

        const filepath = path.join(uploadDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.json({ success: true, data: 'File deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
