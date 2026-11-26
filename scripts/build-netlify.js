const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function copyDirSync(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy storefront to /
copyDirSync(path.join(rootDir, 'public'), distDir);

// 2. Copy admin panel to /admin
copyDirSync(path.join(rootDir, 'admin'), path.join(distDir, 'admin'));

// 3. Copy seeded product & category images to /uploads so CDN serves them fast
copyDirSync(path.join(rootDir, 'server', 'uploads'), path.join(distDir, 'uploads'));

console.log('Built Netlify publish directory at:', distDir);
