const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');

const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

const fileFilter = (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpg, jpeg, png, gif, webp)'), false);
    }
};

// Always capture upload in memory so DB persistence works seamlessly on serverless read-only filesystems
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: fileFilter
});

router.post('/', authenticateToken, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }

        const fileUrls = [];
        for (const file of req.files) {
            const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
            const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;

            // Save to DB permanently
            await db.run(
                `INSERT INTO uploaded_files (filename, mime_type, data_base64)
                 VALUES (?, ?, ?)
                 ON CONFLICT(filename) DO UPDATE SET mime_type = excluded.mime_type, data_base64 = excluded.data_base64`,
                [filename, file.mimetype || 'image/jpeg', file.buffer.toString('base64')]
            );

            // Write to local disk cache when running in writable non-serverless environments
            if (!isServerless) {
                try {
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
                } catch (e) {}
            }

            fileUrls.push(`/uploads/${filename}`);
        }

        res.json({ success: true, data: fileUrls });
    } catch (err) {
        console.error('Upload error:', err);
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

        if (!isServerless) {
            const filepath = path.join(uploadDir, filename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }
        res.json({ success: true, data: 'File deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
