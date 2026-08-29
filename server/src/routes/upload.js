const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
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

router.post('/', authenticateToken, upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'No files uploaded' });
        }
        const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ success: true, data: fileUrls });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

router.delete('/:filename', authenticateToken, (req, res) => {
    try {
        const filename = req.params.filename;
        // Basic path traversal prevention
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }
        
        const filepath = path.join(uploadDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            res.json({ success: true, data: 'File deleted' });
        } else {
            res.status(404).json({ success: false, error: 'File not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

module.exports = router;
