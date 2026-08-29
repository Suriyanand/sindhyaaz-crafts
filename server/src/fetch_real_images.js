const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// 70 High quality curated Unsplash image URLs for gifts
const imageSources = [
    // Personalized Gifts (1-10)
    { filename: 'necklace-gold.jpg', url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80' },
    { filename: 'photo-plaque-wooden.jpg', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80' },
    { filename: 'leather-wallet.jpg', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80' },
    { filename: 'acrylic-song-plaque.jpg', url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80' },
    { filename: 'pen-diary-set.jpg', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80' },
    { filename: 'neon-light-sign.jpg', url: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80' },
    { filename: 'passport-cover.jpg', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80' },
    { filename: 'crystal-cube.jpg', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80' },
    { filename: 'watch-box.jpg', url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80' },
    { filename: 'silver-bracelet.jpg', url: 'https://images.unsplash.com/photo-1611591475179-62cd34891338?w=600&auto=format&fit=crop&q=80' },

    // Photo Gifts (11-20)
    { filename: 'led-photo-frame.jpg', url: 'https://images.unsplash.com/photo-1582562124811-c09040d0a901?w=600&auto=format&fit=crop&q=80' },
    { filename: 'photo-wall-clock.jpg', url: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&auto=format&fit=crop&q=80' },
    { filename: 'rotating-lamp.jpg', url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80' },
    { filename: 'cushion-pillow.jpg', url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&auto=format&fit=crop&q=80' },
    { filename: 'canvas-frame-set.jpg', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80' },
    { filename: 'memory-box-album.jpg', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80' },
    { filename: 'fridge-magnets.jpg', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80' },
    { filename: 'desk-calendar.jpg', url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&auto=format&fit=crop&q=80' },
    { filename: 'film-roll-keychain.jpg', url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80' },
    { filename: 'string-lights-photo.jpg', url: 'https://images.unsplash.com/photo-1519751138061-436e3b328632?w=600&auto=format&fit=crop&q=80' },

    // Mugs & Bottles (21-30)
    { filename: 'magic-mug.jpg', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80' },
    { filename: 'couple-mugs.jpg', url: 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=600&auto=format&fit=crop&q=80' },
    { filename: 'temp-flask-bottle.jpg', url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&auto=format&fit=crop&q=80' },
    { filename: 'black-matte-mug.jpg', url: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80' },
    { filename: 'steel-water-bottle.jpg', url: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?w=600&auto=format&fit=crop&q=80' },
    { filename: 'pink-heart-mug.jpg', url: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=600&auto=format&fit=crop&q=80' },
    { filename: 'glass-tumbler.jpg', url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80' },
    { filename: 'beer-mug-glass.jpg', url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&auto=format&fit=crop&q=80' },
    { filename: 'floral-ceramic-mug.jpg', url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80' },
    { filename: 'kids-sipper-bottle.jpg', url: 'https://images.unsplash.com/photo-1570831739435-660143a4e5d3?w=600&auto=format&fit=crop&q=80' },

    // Keychains (31-40)
    { filename: 'resin-flower-keychain.jpg', url: 'https://images.unsplash.com/photo-1620656798579-1984d9e87dfd?w=600&auto=format&fit=crop&q=80' },
    { filename: 'leather-keychain.jpg', url: 'https://images.unsplash.com/photo-1614332287897-cdc485fa562d?w=600&auto=format&fit=crop&q=80' },
    { filename: 'photo-metal-keychain.jpg', url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80' },
    { filename: 'couple-magnetic-keychain.jpg', url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80' },
    { filename: 'car-plate-keychain.jpg', url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?w=600&auto=format&fit=crop&q=80' },
    { filename: 'wooden-car-charm.jpg', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80' },
    { filename: 'spotify-acrylic-keychain.jpg', url: 'https://images.unsplash.com/photo-1614680376593-902f749f7b6c?w=600&auto=format&fit=crop&q=80' },
    { filename: 'qr-code-keychain.jpg', url: 'https://images.unsplash.com/photo-1595079672139-cee2569527ec?w=600&auto=format&fit=crop&q=80' },
    { filename: 'teddy-charm-keychain.jpg', url: 'https://images.unsplash.com/photo-1559454403-b8fb88521f11?w=600&auto=format&fit=crop&q=80' },
    { filename: 'brass-monogram-keychain.jpg', url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&auto=format&fit=crop&q=80' },

    // Home Decor (41-50)
    { filename: 'moon-lamp-3d.jpg', url: 'https://images.unsplash.com/photo-1532009877282-3340270e0529?w=600&auto=format&fit=crop&q=80' },
    { filename: 'family-nameplate-wooden.jpg', url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80' },
    { filename: 'resin-flower-clock.jpg', url: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=600&auto=format&fit=crop&q=80' },
    { filename: 'ceramic-vase-pampas.jpg', url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80' },
    { filename: 'couple-shadow-box.jpg', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&auto=format&fit=crop&q=80' },
    { filename: 'led-name-night-lamp.jpg', url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&auto=format&fit=crop&q=80' },
    { filename: 'vintage-wooden-box.jpg', url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80' },
    { filename: 'macrame-wall-decor.jpg', url: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=600&auto=format&fit=crop&q=80' },
    { filename: 'scented-candles-set.jpg', url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&auto=format&fit=crop&q=80' },
    { filename: 'sun-catcher-crystal.jpg', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80' },

    // Combo Sets (51-60)
    { filename: 'anniversary-luxury-hamper.jpg', url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=600&auto=format&fit=crop&q=80' },
    { filename: 'birthday-surprise-box.jpg', url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=600&auto=format&fit=crop&q=80' },
    { filename: 'mens-grooming-combo.jpg', url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&auto=format&fit=crop&q=80' },
    { filename: 'valentines-teddy-hamper.jpg', url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80' },
    { filename: 'desk-organizer-set.jpg', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80' },
    { filename: 'bride-to-be-spa-box.jpg', url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=80' },
    { filename: 'pastel-stationery-hamper.jpg', url: 'https://images.unsplash.com/photo-1585336261026-8f57857820f2?w=600&auto=format&fit=crop&q=80' },
    { filename: 'chocolates-mug-combo.jpg', url: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&auto=format&fit=crop&q=80' },
    { filename: 'travel-passport-tag-combo.jpg', url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop&q=80' },
    { filename: 'best-friend-gift-box.jpg', url: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=600&auto=format&fit=crop&q=80' },

    // Return Gifts (61-70)
    { filename: 'succulent-plant-pot.jpg', url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&auto=format&fit=crop&q=80' },
    { filename: 'scented-jar-candle-mini.jpg', url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&auto=format&fit=crop&q=80' },
    { filename: 'brass-diya-set.jpg', url: 'https://images.unsplash.com/photo-1605647540924-852290f6b0d5?w=600&auto=format&fit=crop&q=80' },
    { filename: 'potli-bag-embroidered.jpg', url: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&auto=format&fit=crop&q=80' },
    { filename: 'wooden-tea-coasters.jpg', url: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=600&auto=format&fit=crop&q=80' },
    { filename: 'seed-paper-notepad.jpg', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80' },
    { filename: 'mini-favor-mug-box.jpg', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop&q=80' },
    { filename: 'handpainted-wooden-elephant.jpg', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80' },
    { filename: 'organza-dry-fruits-pouch.jpg', url: 'https://images.unsplash.com/photo-1508061252220-333e8c952044?w=600&auto=format&fit=crop&q=80' },
    { filename: 'keychain-pen-favor-pack.jpg', url: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=600&auto=format&fit=crop&q=80' }
];

function downloadFile(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(filepath));
            });
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });

        request.setTimeout(15000, () => {
            request.destroy();
            reject(new Error('Timeout'));
        });
    });
}

async function downloadAll() {
    console.log(`Downloading ${imageSources.length} images to uploads folder...`);
    let successCount = 0;
    
    for (let i = 0; i < imageSources.length; i++) {
        const item = imageSources[i];
        const dest = path.join(uploadsDir, item.filename);
        try {
            await downloadFile(item.url, dest);
            successCount++;
            console.log(`[${i + 1}/${imageSources.length}] Downloaded ${item.filename}`);
        } catch (err) {
            console.error(`Failed ${item.filename}:`, err.message);
        }
    }
    console.log(`\nSuccessfully downloaded ${successCount}/${imageSources.length} images!`);
}

downloadAll();
