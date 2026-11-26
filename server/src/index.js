const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Static files & DB-backed upload fallback
const uploadsPath = process.env.UPLOAD_DIR || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// If an uploaded image was lost on an ephemeral disk restart, serve it seamlessly from the database
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
        // Warm local cache asynchronously
        try {
            fs.writeFileSync(path.join(uploadsPath, filename), buffer);
        } catch (e) {}

        res.set('Content-Type', record.mime_type || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
    } catch (err) {
        return next();
    }
});

app.use('/', express.static(path.join(__dirname, '../../public')));
app.use('/admin', express.static(path.join(__dirname, '../../admin')));

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
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const uploadRoutes = require('./routes/upload');
const paymentRoutes = require('./routes/payment');
const settingsRoutes = require('./routes/settings');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/user');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something broke!' });
});

// Initialize database before accepting traffic
db.init()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
