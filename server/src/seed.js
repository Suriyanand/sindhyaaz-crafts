const bcrypt = require('bcryptjs');
const db = require('./database');

async function seed() {
    console.log('Seeding database with 70 products (10 per category) and real product images...');

    // Clear existing data
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM categories').run();
    db.prepare('DELETE FROM admin_users').run();
    db.prepare('DELETE FROM site_settings').run();

    // Reset autoincrement sequences
    try {
        db.prepare('DELETE FROM sqlite_sequence WHERE name IN ("products", "categories", "admin_users")').run();
    } catch(e) {}

    // Seed Admin User
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_users (username, password_hash, name) VALUES (?, ?, ?)').run(
        'admin', passwordHash, 'GiftLux Admin'
    );
    console.log('Admin user created (admin / admin123)');

    // Seed Categories
    const categories = [
        { id: 1, name: 'Personalized Gifts', slug: 'personalized-gifts', image: 'necklace-gold.jpg', description: 'Custom handcrafted gifts personalized with names & messages ✨', sort_order: 1 },
        { id: 2, name: 'Photo Gifts', slug: 'photo-gifts', image: 'led-photo-frame.jpg', description: 'Capture precious memories in frames, lamps & keepsakes 📸', sort_order: 2 },
        { id: 3, name: 'Mugs & Bottles', slug: 'mugs-bottles', image: 'magic-mug.jpg', description: 'Custom printed mugs, magic mugs & temperature flasks ☕', sort_order: 3 },
        { id: 4, name: 'Keychains', slug: 'keychains', image: 'resin-flower-keychain.jpg', description: 'Resin, leather, photo & acrylic custom keychains 🔑', sort_order: 4 },
        { id: 5, name: 'Home Decor', slug: 'home-decor', image: 'moon-lamp-3d.jpg', description: 'Aesthetic 3D moon lamps, nameplates & room decor 🏠', sort_order: 5 },
        { id: 6, name: 'Combo Sets', slug: 'combo-sets', image: 'anniversary-luxury-hamper.jpg', description: 'Curated luxury hampers & birthday surprise gift boxes 🎀', sort_order: 6 },
        { id: 7, name: 'Return Gifts', slug: 'return-gifts', image: 'succulent-plant-pot.jpg', description: 'Eco plants, candles, potli bags & wedding favors 🎉', sort_order: 7 }
    ];

    const insertCat = db.prepare('INSERT INTO categories (id, name, slug, image, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    categories.forEach(c => insertCat.run(c.id, c.name, c.slug, c.image, c.description, c.sort_order));
    console.log('Created 7 categories');

    // 70 Realistic Gift Products (10 per category)
    const products = [
        // Category 1: Personalized Gifts
        {
            name: 'Custom 18K Gold Plated Name Necklace',
            slug: 'custom-18k-gold-plated-name-necklace',
            description: 'Crafted with premium stainless steel with 18k gold plating. Water-resistant, non-tarnishable, personalized with your custom name in elegant script typography.',
            price: 999, compare_price: 1499, category_id: 1, stock: 45, is_featured: 1, badge: 'Bestseller', images: ['necklace-gold.jpg']
        },
        {
            name: 'Engraved Wooden Photo Plaque',
            slug: 'engraved-wooden-photo-plaque',
            description: 'Natural solid beechwood plaque laser-carved with your favorite photo and custom personal message. Comes with a sturdy wooden easel stand.',
            price: 799, compare_price: 1199, category_id: 1, stock: 30, is_featured: 1, badge: 'Hot', images: ['photo-plaque-wooden.jpg']
        },
        {
            name: 'Personalized Leather Wallet with Name Tag',
            slug: 'personalized-leather-wallet-with-name-tag',
            description: 'Genuine leather slim bi-fold wallet featuring custom metal charm and laser engraved name. Contains 6 card slots, cash divider, and coin pocket.',
            price: 699, compare_price: 999, category_id: 1, stock: 50, is_featured: 0, badge: 'New', images: ['leather-wallet.jpg']
        },
        {
            name: 'Custom Spotify Song Acrylic Plaque with Stand',
            slug: 'custom-spotify-song-acrylic-plaque-with-stand',
            description: 'High-clarity acrylic plaque featuring your favorite song album cover, Spotify scannable code, and custom dedication quote.',
            price: 899, compare_price: 1299, category_id: 1, stock: 40, is_featured: 1, badge: 'Trending', images: ['acrylic-song-plaque.jpg']
        },
        {
            name: 'Engraved Executive Pen & Leather Diary Set',
            slug: 'engraved-executive-pen-and-leather-diary-set',
            description: 'Premium metal rollerball pen and PU leather diary embossed with custom name. Ideal corporate and birthday gift for professionals.',
            price: 599, compare_price: 899, category_id: 1, stock: 35, is_featured: 0, badge: null, images: ['pen-diary-set.jpg']
        },
        {
            name: 'Custom Name LED Neon Light Sign',
            slug: 'custom-name-led-neon-light-sign',
            description: 'Vibrant LED neon flex tubing mounted on crystal clear acrylic backdrop. Perfect aesthetic room decor and birthday backdrop sign.',
            price: 1999, compare_price: 2999, category_id: 1, stock: 15, is_featured: 1, badge: 'Hot', images: ['neon-light-sign.jpg']
        },
        {
            name: 'Custom Name Embossed Passport Cover',
            slug: 'custom-name-embossed-passport-cover',
            description: 'Durable synthetic leather passport holder with metal charm and metallic name tag embossing. Keeps passport and travel cards safe.',
            price: 499, compare_price: 799, category_id: 1, stock: 60, is_featured: 0, badge: null, images: ['passport-cover.jpg']
        },
        {
            name: '3D Laser Engraved Crystal Cube with LED Base',
            slug: '3d-laser-engraved-crystal-cube-with-led-base',
            description: 'Optical K9 crystal laser-engraved internally in 3D. Includes colorful rotating LED light base to illuminate your photo memories.',
            price: 1299, compare_price: 1799, category_id: 1, stock: 25, is_featured: 0, badge: null, images: ['crystal-cube.jpg']
        },
        {
            name: 'Engraved Wooden Watch & Accessories Box',
            slug: 'engraved-wooden-watch-and-accessories-box',
            description: 'Handcrafted wooden watch organizer box with glass top lid personalized with custom initials. Holds 6 watches with soft cushions.',
            price: 1499, compare_price: 2199, category_id: 1, stock: 20, is_featured: 0, badge: null, images: ['watch-box.jpg']
        },
        {
            name: 'Custom Name Engraved Silver Bracelet',
            slug: 'custom-name-engraved-silver-bracelet',
            description: 'Sterling silver plated adjustable cuff bracelet customized with engraved name or special coordinates. Comes in a gift pouch.',
            price: 849, compare_price: 1199, category_id: 1, stock: 30, is_featured: 0, badge: null, images: ['silver-bracelet.jpg']
        },

        // Category 2: Photo Gifts
        {
            name: 'Romantic LED Glowing Photo Frame',
            slug: 'romantic-led-glowing-photo-frame',
            description: 'Warm LED back-lit photo frame designed to illuminate your special memory. Uses energy-efficient warm yellow fairy LED lighting.',
            price: 1199, compare_price: 1699, category_id: 2, stock: 35, is_featured: 1, badge: 'Bestseller', images: ['led-photo-frame.jpg']
        },
        {
            name: 'Customized Memories Photo Wall Clock',
            slug: 'customized-memories-photo-wall-clock',
            description: '12-inch high-density MDF wall clock featuring 12 of your favorite photos as hour markers. Silent sweep quartz clock movement.',
            price: 999, compare_price: 1499, category_id: 2, stock: 25, is_featured: 0, badge: null, images: ['photo-wall-clock.jpg']
        },
        {
            name: '4-Side Rotating Photo Lamp Tower',
            slug: '4-side-rotating-photo-lamp-tower',
            description: 'Automatic rotating night lamp displaying 4 full-size photo prints. Emits warm soothing ambient light perfect for bedside decor.',
            price: 1399, compare_price: 1999, category_id: 2, stock: 20, is_featured: 1, badge: 'Hot', images: ['rotating-lamp.jpg']
        },
        {
            name: 'Customized Square Photo Cushion Pillow',
            slug: 'customized-square-photo-cushion-pillow',
            description: 'Soft velvet microfiber 16x16 inch cushion printed with high-definition vibrant photo print. Includes plush filler insert.',
            price: 549, compare_price: 799, category_id: 2, stock: 40, is_featured: 0, badge: null, images: ['cushion-pillow.jpg']
        },
        {
            name: 'Set of 3 Mini Photo Canvas Prints with Stand',
            slug: 'set-of-3-mini-photo-canvas-prints-with-stand',
            description: 'Textured gallery canvas prints stretched over wooden mini easels (4x4 inch each). Beautiful aesthetic room decor accents.',
            price: 799, compare_price: 1099, category_id: 2, stock: 30, is_featured: 0, badge: null, images: ['canvas-frame-set.jpg']
        },
        {
            name: 'Explosive Photo Memory Box Album',
            slug: 'explosive-photo-memory-box-album',
            description: 'Handmade explosion box album containing 24 photo slots, pop-up greeting cards, and a surprise mini gift compartment in the center.',
            price: 699, compare_price: 999, category_id: 2, stock: 28, is_featured: 1, badge: 'New', images: ['memory-box-album.jpg']
        },
        {
            name: 'Set of 6 Custom Photo Fridge Magnets',
            slug: 'set-of-6-custom-photo-fridge-magnets',
            description: 'Glossy acrylic fridge magnets printed with your favorite holiday and family photos. Super strong magnetic backing.',
            price: 399, compare_price: 599, category_id: 2, stock: 50, is_featured: 0, badge: null, images: ['fridge-magnets.jpg']
        },
        {
            name: 'Personalized Desk Photo Calendar 2026',
            slug: 'personalized-desk-photo-calendar-2026',
            description: '12-month spiral desk calendar with a different photo memory printed on every month page. Printed on thick 300 GSM matte cardstock.',
            price: 499, compare_price: 699, category_id: 2, stock: 45, is_featured: 0, badge: null, images: ['desk-calendar.jpg']
        },
        {
            name: 'Vintage Camera Film Roll Photo Keychain',
            slug: 'vintage-camera-film-roll-photo-keychain',
            description: 'Pull-out vintage 35mm film canister keychain revealing 10 custom printed mini photos inside. Unique nostaligic romantic keepsake.',
            price: 449, compare_price: 699, category_id: 2, stock: 55, is_featured: 1, badge: 'Trending', images: ['film-roll-keychain.jpg']
        },
        {
            name: 'LED String Lights with Wooden Photo Clips',
            slug: 'led-string-lights-with-wooden-photo-clips',
            description: '3-meter copper wire LED fairy lights with 20 mini wooden clothespins to hang your polaroid photo prints on bedroom walls.',
            price: 399, compare_price: 599, category_id: 2, stock: 60, is_featured: 0, badge: null, images: ['string-lights-photo.jpg']
        },

        // Category 3: Mugs & Bottles
        {
            name: 'Magic Temperature Color Changing Photo Mug',
            slug: 'magic-temperature-color-changing-photo-mug',
            description: 'Heat-sensitive ceramic mug that appears black when cold and magically reveals your custom photo print when hot beverage is poured in.',
            price: 499, compare_price: 799, category_id: 3, stock: 50, is_featured: 1, badge: 'Bestseller', images: ['magic-mug.jpg']
        },
        {
            name: 'Mr & Mrs Ceramic Couple Coffee Mug Set',
            slug: 'mr-and-mrs-ceramic-couple-coffee-mug-set',
            description: 'Matching marble texture ceramic mugs with gold foil lettering & lids with spoon. Packaged in a luxurious gift box.',
            price: 699, compare_price: 999, category_id: 3, stock: 35, is_featured: 1, badge: 'Hot', images: ['couple-mugs.jpg']
        },
        {
            name: 'Smart LED Temperature Display Vacuum Flask 500ml',
            slug: 'smart-led-temperature-display-vacuum-flask-500ml',
            description: 'Double-walled insulated stainless steel bottle with touch LED screen indicating exact liquid temperature. Keeps drinks hot/cold for 12 hrs.',
            price: 799, compare_price: 1199, category_id: 3, stock: 40, is_featured: 0, badge: null, images: ['temp-flask-bottle.jpg']
        },
        {
            name: 'Custom Name Matte Black Ceramic Mug',
            slug: 'custom-name-matte-black-ceramic-mug',
            description: 'Minimalist 350ml matte black ceramic mug customized with metallic gold or silver printed name. Microwave & dishwasher safe.',
            price: 399, compare_price: 599, category_id: 3, stock: 45, is_featured: 0, badge: null, images: ['black-matte-mug.jpg']
        },
        {
            name: 'Customized Stainless Steel Water Bottle',
            slug: 'customized-stainless-steel-water-bottle',
            description: '750ml eco-friendly food-grade stainless steel bottle personalized with laser engraved name and icon. Leak-proof sports cap.',
            price: 599, compare_price: 899, category_id: 3, stock: 30, is_featured: 0, badge: null, images: ['steel-water-bottle.jpg']
        },
        {
            name: 'Cute Heart Handle Pink Personalized Mug',
            slug: 'cute-heart-handle-pink-personalized-mug',
            description: 'Adorable pastel pink ceramic mug featuring a heart-shaped handle and custom photo/text printing on both sides.',
            price: 449, compare_price: 649, category_id: 3, stock: 40, is_featured: 0, badge: null, images: ['pink-heart-mug.jpg']
        },
        {
            name: 'Aesthetic Glass Tumbler with Straw & Silicone Sleeve',
            slug: 'aesthetic-glass-tumbler-with-straw-and-silicone-sleeve',
            description: 'Borosilicate clear glass iced coffee tumbler with bamboo wooden lid, reusable glass straw, and non-slip protective silicone sleeve.',
            price: 649, compare_price: 899, category_id: 3, stock: 25, is_featured: 1, badge: 'New', images: ['glass-tumbler.jpg']
        },
        {
            name: 'Engraved Heavy Glass Beer Mug 500ml',
            slug: 'engraved-heavy-glass-beer-mug-500ml',
            description: 'Thick glass beer tankard customized with laser engraved name, age or custom emblem. Sturdy thumb handle.',
            price: 599, compare_price: 799, category_id: 3, stock: 30, is_featured: 0, badge: null, images: ['beer-mug-glass.jpg']
        },
        {
            name: 'Handcrafted Floral Ceramic Tea Mug',
            slug: 'handcrafted-floral-ceramic-tea-mug',
            description: 'Artisanal stoneware tea cup hand-painted with botanical floral motifs. Microwave safe ceramic construction.',
            price: 349, compare_price: 499, category_id: 3, stock: 50, is_featured: 0, badge: null, images: ['floral-ceramic-mug.jpg']
        },
        {
            name: 'Cute Personalized Kids Water Sipper Bottle',
            slug: 'cute-personalized-kids-water-sipper-bottle',
            description: 'BPA-free aluminum water bottle with pop-up straw spout & shoulder strap, printed with cartoon character and child name.',
            price: 499, compare_price: 699, category_id: 3, stock: 35, is_featured: 0, badge: null, images: ['kids-sipper-bottle.jpg']
        },

        // Category 4: Keychains
        {
            name: 'Real Dried Flower Resin Letter Keychain',
            slug: 'real-dried-flower-resin-letter-keychain',
            description: 'Hand-poured crystal clear epoxy resin initial letter containing real preserved dried flowers and gold leaf flakes. Includes plush pom-pom.',
            price: 299, compare_price: 499, category_id: 4, stock: 60, is_featured: 1, badge: 'Bestseller', images: ['resin-flower-keychain.jpg']
        },
        {
            name: 'Premium Leather Braided Key Ring',
            slug: 'premium-leather-braided-key-ring',
            description: 'Handwoven genuine leather cord keychain with zinc alloy metal clasp and custom engraved charm. Durable and stylish.',
            price: 249, compare_price: 399, category_id: 4, stock: 50, is_featured: 0, badge: null, images: ['leather-keychain.jpg']
        },
        {
            name: 'Double-Sided Metal Photo Keychain',
            slug: 'double-sided-metal-photo-keychain',
            description: 'Heavy duty stainless steel metal photo keychain displaying custom printed photos on both sides with epoxy glass protection.',
            price: 349, compare_price: 499, category_id: 4, stock: 45, is_featured: 0, badge: null, images: ['photo-metal-keychain.jpg']
        },
        {
            name: 'Magnetic Heart Couple Keychain Set',
            slug: 'magnetic-heart-couple-keychain-set',
            description: 'Pair of matching keychains that magnetically lock together to form a complete heart when close. Ideal romantic gift.',
            price: 399, compare_price: 599, category_id: 4, stock: 40, is_featured: 1, badge: 'Hot', images: ['couple-magnetic-keychain.jpg']
        },
        {
            name: 'Custom Metallic Car Number Plate Keychain',
            slug: 'custom-metallic-car-number-plate-keychain',
            description: 'Miniature replica of your vehicle license number plate customized with your registration number and car brand logo.',
            price: 299, compare_price: 449, category_id: 4, stock: 55, is_featured: 0, badge: null, images: ['car-plate-keychain.jpg']
        },
        {
            name: 'Engraved Wooden Car Rearview Mirror Charm',
            slug: 'engraved-wooden-car-rearview-mirror-charm',
            description: 'Custom carved wooden hanging charm for car dashboard or rearview mirror engraved with blessing or custom photo.',
            price: 329, compare_price: 499, category_id: 4, stock: 35, is_featured: 0, badge: null, images: ['wooden-car-charm.jpg']
        },
        {
            name: 'Custom Scannable Spotify Code Acrylic Keychain',
            slug: 'custom-scannable-spotify-code-acrylic-keychain',
            description: 'Transparent acrylic keychain printed with Spotify song code. Scan using Spotify camera to instantly play your favorite track.',
            price: 279, compare_price: 399, category_id: 4, stock: 65, is_featured: 0, badge: null, images: ['spotify-acrylic-keychain.jpg']
        },
        {
            name: 'Smart Digital QR Code Contact Keychain',
            slug: 'smart-digital-qr-code-contact-keychain',
            description: 'Laser engraved metal QR keychain linking directly to your digital business card, emergency contact, or Instagram profile.',
            price: 349, compare_price: 499, category_id: 4, stock: 30, is_featured: 0, badge: null, images: ['qr-code-keychain.jpg']
        },
        {
            name: 'Cute Soft Teddy Bear Charm Keychain',
            slug: 'cute-soft-teddy-bear-charm-keychain',
            description: 'Adorably soft plush mini teddy bear charm with woven strap and pastel bell. Great accessory for bags & keys.',
            price: 229, compare_price: 349, category_id: 4, stock: 70, is_featured: 0, badge: null, images: ['teddy-charm-keychain.jpg']
        },
        {
            name: 'Luxury Brass Monogram Engraved Keychain',
            slug: 'luxury-brass-monogram-engraved-keychain',
            description: 'Solid polished brass keychain engraved with custom monogram letter and name. Comes packaged in a premium velvet pouch.',
            price: 399, compare_price: 599, category_id: 4, stock: 40, is_featured: 1, badge: 'New', images: ['brass-monogram-keychain.jpg']
        },

        // Category 5: Home Decor
        {
            name: 'Personalized 3D Moon Lamp with Wooden Base',
            slug: 'personalized-3d-moon-lamp-with-wooden-base',
            description: 'Rechargeable 3D printed lunar globe lamp customized with your photo and message. Features 16 color RGB touch sensor remote control.',
            price: 1299, compare_price: 1899, category_id: 5, stock: 30, is_featured: 1, badge: 'Bestseller', images: ['moon-lamp-3d.jpg']
        },
        {
            name: 'Handcrafted Wooden Family Nameplate for Home',
            slug: 'handcrafted-wooden-family-nameplate-for-home',
            description: 'Weatherproof teak wood entrance door nameplate customized with laser carved names and brass house number.',
            price: 1499, compare_price: 2199, category_id: 5, stock: 20, is_featured: 0, badge: null, images: ['family-nameplate-wooden.jpg']
        },
        {
            name: 'Handcrafted Resin Dried Flower Wall Clock',
            slug: 'handcrafted-resin-dried-flower-wall-clock',
            description: '12-inch luxury resin wall clock infused with real dried botanical flowers and metallic Roman numeral hour markers.',
            price: 1899, compare_price: 2699, category_id: 5, stock: 15, is_featured: 1, badge: 'Hot', images: ['resin-flower-clock.jpg']
        },
        {
            name: 'Aesthetic Ceramic Vase with Pampas Grass Combo',
            slug: 'aesthetic-ceramic-vase-with-pampas-grass-combo',
            description: 'Nordic donut ceramic vase paired with 5 stalks of natural dried fluffy pampas grass. Adds cozy aesthetic to any tabletop.',
            price: 899, compare_price: 1299, category_id: 5, stock: 35, is_featured: 0, badge: null, images: ['ceramic-vase-pampas.jpg']
        },
        {
            name: 'Romantic Couple Silhouette Shadow Box Lamp',
            slug: 'romantic-couple-silhouette-shadow-box-lamp',
            description: 'Multi-layer laser cut paper shadow box with warm backlight creating a fairytale romantic couple scene.',
            price: 1199, compare_price: 1699, category_id: 5, stock: 25, is_featured: 0, badge: null, images: ['couple-shadow-box.jpg']
        },
        {
            name: 'Acrylic LED Name Night Light for Bedroom',
            slug: 'acrylic-led-name-night-light-for-bedroom',
            description: 'Personalized acrylic night light with warm wooden base illuminated by soft LED lighting. Customized with your name or nickname.',
            price: 799, compare_price: 1099, category_id: 5, stock: 40, is_featured: 1, badge: 'New', images: ['led-name-night-lamp.jpg']
        },
        {
            name: 'Hand-Carved Vintage Wooden Keepsake Box',
            slug: 'hand-carved-vintage-wooden-keepsake-box',
            description: 'Antique mango wood carved jewelry & trinket box with brass latch. Great home decor piece and gift box.',
            price: 999, compare_price: 1499, category_id: 5, stock: 25, is_featured: 0, badge: null, images: ['vintage-wooden-box.jpg']
        },
        {
            name: 'Boho Handwoven Macrame Wall Decor',
            slug: 'boho-handwoven-macrame-wall-decor',
            description: 'Handcrafted 100% cotton woven macrame tapestry hanging on natural wooden dowel branch.',
            price: 699, compare_price: 999, category_id: 5, stock: 30, is_featured: 0, badge: null, images: ['macrame-wall-decor.jpg']
        },
        {
            name: 'Set of 4 Luxury Soy Scented Candles Gift Pack',
            slug: 'set-of-4-luxury-soy-scented-candles-gift-pack',
            description: 'Natural soy wax aromatherapy candles in glass tins (Lavender, Vanilla, Rose, Ocean Breeze). Burns clean for 25 hrs each.',
            price: 849, compare_price: 1199, category_id: 5, stock: 45, is_featured: 0, badge: null, images: ['scented-candles-set.jpg']
        },
        {
            name: 'Prism Rainbow Crystal Sun Catcher Pendant',
            slug: 'prism-rainbow-crystal-sun-catcher-pendant',
            description: 'Sparkling K9 glass prism chandelier crystal that casts vibrant rainbows across the room when sunlight strikes.',
            price: 499, compare_price: 699, category_id: 5, stock: 50, is_featured: 0, badge: null, images: ['sun-catcher-crystal.jpg']
        },

        // Category 6: Combo Sets
        {
            name: 'Royal Anniversary Luxury Gift Hamper Box',
            slug: 'royal-anniversary-luxury-gift-hamper-box',
            description: 'Grand gift hamper containing customized photo frame, couple ceramic mugs, scented soy candle, gold rose & Ferrero Rocher box.',
            price: 2499, compare_price: 3499, category_id: 6, stock: 20, is_featured: 1, badge: 'Bestseller', images: ['anniversary-luxury-hamper.jpg']
        },
        {
            name: 'Ultimate Birthday Celebration Gift Box',
            slug: 'ultimate-birthday-celebration-gift-box',
            description: 'Festive surprise box with personalized name mug, LED greeting card, mini plush teddy bear, party pop, & gourmet chocolates.',
            price: 1999, compare_price: 2799, category_id: 6, stock: 25, is_featured: 1, badge: 'Hot', images: ['birthday-surprise-box.jpg']
        },
        {
            name: 'Executive Mens Grooming & Leather Wallet Set',
            slug: 'executive-mens-grooming-and-leather-wallet-set',
            description: 'Includes personalized leather wallet, custom metal keychain, luxury body spray, and metallic rollerball pen in a wooden box.',
            price: 1499, compare_price: 2199, category_id: 6, stock: 30, is_featured: 0, badge: null, images: ['mens-grooming-combo.jpg']
        },
        {
            name: 'Romantic Teddy, Rose & Chocolate Gift Box',
            slug: 'romantic-teddy-rose-and-chocolate-gift-box',
            description: 'Heart-shaped box packed with a plush red teddy bear, gold-plated velvet rose, and 12 premium hand-crafted chocolates.',
            price: 1299, compare_price: 1799, category_id: 6, stock: 35, is_featured: 0, badge: null, images: ['valentines-teddy-hamper.jpg']
        },
        {
            name: 'Personalized Office Desk Organizer Gift Combo',
            slug: 'personalized-office-desk-organizer-gift-combo',
            description: 'Leatherette desk mat, personalized pen stand, thermal mug, and leather diary set embossed with custom recipient name.',
            price: 1699, compare_price: 2399, category_id: 6, stock: 20, is_featured: 0, badge: null, images: ['desk-organizer-set.jpg']
        },
        {
            name: 'Luxury Bride-to-Be Pamper & Spa Box',
            slug: 'luxury-bride-to-be-pamper-and-spa-box',
            description: 'Bridal shower hamper with Bride silk robe, personalized champagne tumbler, bath bomb, scented candle & satin eye mask.',
            price: 1899, compare_price: 2699, category_id: 6, stock: 15, is_featured: 1, badge: 'New', images: ['bride-to-be-spa-box.jpg']
        },
        {
            name: 'Aesthetic Pastel Stationery & Mug Gift Set',
            slug: 'aesthetic-pastel-stationery-and-mug-gift-set',
            description: 'Cute pastel gift bundle including ceramic coffee mug, pastel highlighters, sticky notes, aesthetic washitapes & planner notebook.',
            price: 899, compare_price: 1299, category_id: 6, stock: 40, is_featured: 0, badge: null, images: ['pastel-stationery-hamper.jpg']
        },
        {
            name: 'Artisan Chocolates & Custom Mug Gift Combo',
            slug: 'artisan-chocolates-and-custom-mug-gift-combo',
            description: 'Box of 16 premium dark & milk artisan praline chocolates paired with a custom printed ceramic coffee mug.',
            price: 999, compare_price: 1399, category_id: 6, stock: 35, is_featured: 0, badge: null, images: ['chocolates-mug-combo.jpg']
        },
        {
            name: 'Personalized Leatherette Passport & Luggage Tag Combo',
            slug: 'personalized-leatherette-passport-and-luggage-tag-combo',
            description: 'Matching travel gift pair featuring custom name embossed passport wallet and durable luggage tag.',
            price: 849, compare_price: 1199, category_id: 6, stock: 45, is_featured: 0, badge: null, images: ['travel-passport-tag-combo.jpg']
        },
        {
            name: 'Cute Best Friend Appreciation Gift Basket',
            slug: 'cute-best-friend-appreciation-gift-basket',
            description: 'Charming gift hamper with Bestie mug, photo keychain, scented candle, mini teddy bear & personalized friendship card.',
            price: 1199, compare_price: 1599, category_id: 6, stock: 30, is_featured: 0, badge: null, images: ['best-friend-gift-box.jpg']
        },

        // Category 7: Return Gifts
        {
            name: 'Mini Succulent Plant in Eco Jute Pot Favor',
            slug: 'mini-succulent-plant-in-eco-jute-pot-favor',
            description: 'Live low-maintenance mini indoor succulent plant potted in a burlap jute bag wrapped with custom thank you tag.',
            price: 199, compare_price: 299, category_id: 7, stock: 100, is_featured: 1, badge: 'Bestseller', images: ['succulent-plant-pot.jpg']
        },
        {
            name: 'Hand-poured Vanilla Scented Glass Jar Candle',
            slug: 'hand-poured-vanilla-scented-glass-jar-candle',
            description: 'Mini glass jar soy candle with cork lid and ribbon bow. Delightful vanilla fragrance favor gift for guests.',
            price: 249, compare_price: 349, category_id: 7, stock: 80, is_featured: 0, badge: null, images: ['scented-jar-candle-mini.jpg']
        },
        {
            name: 'Traditional Carved Brass Diya Set of 2',
            slug: 'traditional-carved-brass-diya-set-of-2',
            description: 'Handcrafted solid brass oil lamps for puja and festive occasions. Packaged in a velvet presentation box.',
            price: 399, compare_price: 599, category_id: 7, stock: 60, is_featured: 0, badge: null, images: ['brass-diya-set.jpg']
        },
        {
            name: 'Silk Embroidered Drawstring Potli Bag',
            slug: 'silk-embroidered-drawstring-potli-bag',
            description: 'Traditional raw silk potli bag with gold zari thread embroidery and bead tassel handles. Perfect return gift favor pouch.',
            price: 179, compare_price: 279, category_id: 7, stock: 120, is_featured: 0, badge: null, images: ['potli-bag-embroidered.jpg']
        },
        {
            name: 'Set of 4 Handcrafted Wooden Tea Coasters',
            slug: 'set-of-4-handcrafted-wooden-tea-coasters',
            description: 'Natural wooden drink coasters with protective heat varnish finish. Tied nicely with jute string bow.',
            price: 299, compare_price: 449, category_id: 7, stock: 75, is_featured: 0, badge: null, images: ['wooden-tea-coasters.jpg']
        },
        {
            name: 'Eco-Friendly Plantable Seed Paper Journal',
            slug: 'eco-friendly-plantable-seed-paper-journal',
            description: 'Recycled notepad embedded with wildflower seeds. Plant the cover in soil after use to grow flowers!',
            price: 149, compare_price: 249, category_id: 7, stock: 150, is_featured: 1, badge: 'Eco Friendly', images: ['seed-paper-notepad.jpg']
        },
        {
            name: 'Cute Mini Ceramic Mug in Gift Box',
            slug: 'cute-mini-ceramic-mug-in-gift-box',
            description: '200ml mini espresso coffee mug in individual printed gift box. Available in pastel colors.',
            price: 229, compare_price: 329, category_id: 7, stock: 90, is_featured: 0, badge: null, images: ['mini-favor-mug-box.jpg']
        },
        {
            name: 'Traditional Hand-Painted Wooden Elephant Pair',
            slug: 'traditional-hand-painted-wooden-elephant-pair',
            description: 'Pair of Jaipur ethnic hand-painted wooden elephant figurines symbolize good luck and prosperity.',
            price: 349, compare_price: 499, category_id: 7, stock: 50, is_featured: 0, badge: null, images: ['handpainted-wooden-elephant.jpg']
        },
        {
            name: 'Decorative Organza Pouch with Premium Nuts',
            slug: 'decorative-organza-pouch-with-premium-nuts',
            description: 'Sheer organza drawstring pouch filled with 100g premium roasted almonds & cashews with custom gift tag.',
            price: 299, compare_price: 399, category_id: 7, stock: 110, is_featured: 0, badge: null, images: ['organza-dry-fruits-pouch.jpg']
        },
        {
            name: 'Metal Pen & Monogram Keychain Gift Pack',
            slug: 'metal-pen-and-monogram-keychain-gift-pack',
            description: 'Sleek silver metal ballpoint pen paired with a matching stainless steel keychain in a gift box.',
            price: 269, compare_price: 379, category_id: 7, stock: 85, is_featured: 0, badge: null, images: ['keychain-pen-favor-pack.jpg']
        }
    ];

    const insertProd = db.prepare(`
        INSERT INTO products (name, slug, description, price, compare_price, category_id, stock, is_featured, is_active, badge, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    products.forEach(p => {
        insertProd.run(
            p.name, p.slug, p.description, p.price, p.compare_price,
            p.category_id, p.stock, p.is_featured, p.badge, JSON.stringify(p.images)
        );
    });
    console.log(`Created ${products.length} products with actual product images!`);

    // Seed Site Settings
    const settings = [
        { key: 'shop_name', value: 'Sindhyaaz Crafts & Gifts' },
        { key: 'announcement', value: '✨ Welcome to Sindhyaaz Crafts! Free Shipping on orders over ₹499 ✨ Custom Gifts Made With Love ❤️' },
        { key: 'whatsapp', value: '918098587377' },
        { key: 'phone', value: '8098587377' },
        { key: 'email', value: 'sindhyaazcrafts@gmail.com' },
        { key: 'address', value: 'India' },
        { key: 'currency', value: 'INR' },
        { key: 'free_shipping_threshold', value: '499' },
        { key: 'min_order_amount', value: '199' },
        { key: 'upi_id', value: '8098587377@upi' },
        { key: 'google_client_id', value: '' }
    ];

    const insertSetting = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
    settings.forEach(s => insertSetting.run(s.key, s.value));
    console.log('Site settings seeded.');

    console.log('Seed completed successfully!');
}

seed();
