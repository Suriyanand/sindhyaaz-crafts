const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const isServerless = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Prevent caching on API responses so newly added products appear immediately everywhere
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!isServerless) {
    if (!fs.existsSync(uploadsPath)) {
        fs.mkdirSync(uploadsPath, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsPath));
}

// Serve uploaded images persisted inside database (e.g., runtime admin uploads on Netlify)
app.get('/uploads/:filename', async (req, res, next) => {
    try {
        const filename = req.params.filename;
        if (!filename || filename.includes('..') || filename.includes('/')) {
            return res.status(400).end();
        }
        const record = await db.get(
            'SELECT mime_type, data_base64 FROM uploaded_files WHERE filename = ?',
            [filename]
        );
        if (!record) {
            return next();
        }
        const buffer = Buffer.from(record.data_base64, 'base64');
        if (!isServerless) {
            try {
                fs.writeFileSync(path.join(uploadsPath, filename), buffer);
            } catch (e) {}
        }

        res.set('Content-Type', record.mime_type || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (err) {
        return next();
    }
});

if (!isServerless) {
    app.use('/', express.static(path.join(__dirname, '../../public')));
    app.use('/admin', express.static(path.join(__dirname, '../../admin')));
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        await db.init();
        res.json({ success: true, data: { status: 'ok', storage: db.getStorageInfo() } });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something broke!' });
});

module.exports = { app, db };
