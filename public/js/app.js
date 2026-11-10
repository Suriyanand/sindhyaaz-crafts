// ========================================================
// Sindhyaaz Crafts & Handmade - Production Storefront App
// ========================================================

const CONFIG = {
    API_BASE: '/api',
    UPLOADS_BASE: '/uploads',
    CURRENCY: '₹',
    FREE_SHIPPING_THRESHOLD: 499,
    WHATSAPP_NUMBER: '918098587377',
    STORE_NAME: 'Sindhyaaz Crafts & Handmade'
};

const state = {
    cart: JSON.parse(localStorage.getItem('sindhyaaz_cart') || localStorage.getItem('giftlux_cart') || '[]'),
    user: JSON.parse(localStorage.getItem('sindhyaaz_user') || 'null'),
    token: localStorage.getItem('sindhyaaz_token') || null,
    productsCache: {},
    currentCategorySort: 'newest',
    currentCategorySlug: null
};

// --- Utilities ---
const formatPrice = (price) => `${CONFIG.CURRENCY}${Number(price || 0).toLocaleString('en-IN')}`;

const getPlaceholderImage = (name) => {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="hsl(${hue}, 70%, 92%)"/><text x="50%" y="50%" font-family="sans-serif" font-size="28" font-weight="bold" fill="hsl(${hue}, 70%, 35%)" text-anchor="middle" dominant-baseline="middle">${(name || 'G').charAt(0).toUpperCase()}</text></svg>`;
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : type === 'info' ? 'ℹ️' : '❌'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

// --- API Service ---
const api = {
    async fetch(endpoint, options = {}) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }

            const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
                ...options,
                headers
            });

            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }
            return json.data !== undefined ? json.data : json;
        } catch (error) {
            console.warn(`API call to ${endpoint} failed:`, error.message);
            return null;
        }
    },
    async getProducts(params = '') {
        return await this.fetch(`/products${params ? '?' + params : ''}`);
    },
    async getProduct(slug) {
        return await this.fetch(`/products/${slug}`);
    },
    async createOrder(data) {
        return await this.fetch('/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    async loginUser(email, password) {
        return await this.fetch('/user/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    async registerUser(name, email, password, phone) {
        return await this.fetch('/user/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password, phone })
        });
    },
    async googleLogin(name, email, google_id) {
        return await this.fetch('/user/google-login', {
            method: 'POST',
            body: JSON.stringify({ name, email, google_id })
        });
    },
    async getUserOrders() {
        return await this.fetch('/user/orders');
    },
    async trackOrder(order_number, phone) {
        return await this.fetch('/user/track-order', {
            method: 'POST',
            body: JSON.stringify({ order_number, phone })
        });
    }
};

// --- Cart Manager ---
const cartManager = {
    save() {
        localStorage.setItem('sindhyaaz_cart', JSON.stringify(state.cart));
        localStorage.setItem('giftlux_cart', JSON.stringify(state.cart));
        this.updateBadge();
        this.syncAllCardButtons();
    },
    getItem(id) {
        return state.cart.find(item => String(item.id) === String(id));
    },
    add(product, quantity = 1) {
        if (!product) return;
        const existing = this.getItem(product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            let img = null;
            if (product.images && product.images.length > 0) {
                img = product.images[0].startsWith('http') ? product.images[0] : `${CONFIG.UPLOADS_BASE}/${product.images[0]}`;
            } else {
                img = getPlaceholderImage(product.name);
            }
            state.cart.push({
                id: product.id,
                name: product.name,
                price: Number(product.price),
                image: img,
                quantity: Math.max(1, quantity),
                slug: product.slug || product.id
            });
        }
        this.save();
        showToast(`Added to cart! 🛍️ (${this.getCount()} items)`);
    },
    updateQuantity(id, quantity) {
        const item = this.getItem(id);
        if (item) {
            if (quantity <= 0) {
                this.remove(id);
                return;
            }
            item.quantity = quantity;
            this.save();
            if (window.location.hash.startsWith('#/cart')) renderCart();
        }
    },
    remove(id) {
        state.cart = state.cart.filter(item => String(item.id) !== String(id));
        this.save();
        showToast('Item removed from cart', 'info');
        if (window.location.hash.startsWith('#/cart')) renderCart();
    },
    getTotal() {
        return state.cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    },
    getCount() {
        return state.cart.reduce((sum, item) => sum + item.quantity, 0);
    },
    clear() {
        state.cart = [];
        this.save();
    },
    updateBadge() {
        const count = this.getCount();
        document.querySelectorAll('#cartBadge').forEach(badge => {
            badge.textContent = count;
            badge.style.transform = 'translate(20%, -20%) scale(1.25)';
            setTimeout(() => { badge.style.transform = 'translate(20%, -20%) scale(1)'; }, 200);
        });
    },
    syncAllCardButtons() {
        document.querySelectorAll('[data-product-id]').forEach(wrapper => {
            const productId = wrapper.getAttribute('data-product-id');
            const item = this.getItem(productId);
            if (item && item.quantity > 0) {
                wrapper.innerHTML = `
                    <div class="card-qty-controller">
                        <button class="card-qty-btn minus" onclick="event.preventDefault(); event.stopPropagation(); window.updateCardQty('${productId}', -1)">−</button>
                        <span class="card-qty-value">${item.quantity}</span>
                        <button class="card-qty-btn plus" onclick="event.preventDefault(); event.stopPropagation(); window.updateCardQty('${productId}', 1)">+</button>
                    </div>
                `;
            } else {
                wrapper.innerHTML = `
                    <button class="btn-card-add" onclick="event.preventDefault(); event.stopPropagation(); window.addCardToCart('${productId}')">
                        Add to Cart 🛒
                    </button>
                `;
            }
        });
    }
};

// Global Card Handlers for Instant Interaction
window.addCardToCart = (productId) => {
    const product = state.productsCache[productId];
    if (product) {
        cartManager.add(product, 1);
    }
};

window.updateCardQty = (productId, delta) => {
    const item = cartManager.getItem(productId);
    if (item) {
        cartManager.updateQuantity(productId, item.quantity + delta);
    } else if (delta > 0) {
        window.addCardToCart(productId);
    }
};

// --- UI Components ---
const createProductCard = (product) => {
    const hasDiscount = product.compare_price && product.compare_price > product.price;
    const discountPercent = hasDiscount ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100) : 0;
    
    let imageUrl = getPlaceholderImage(product.name || 'Product');
    if (product.images && product.images.length > 0) {
        imageUrl = product.images[0].startsWith('http') ? product.images[0] : `${CONFIG.UPLOADS_BASE}/${product.images[0]}`;
    }

    state.productsCache[product.id] = product;
    const cartItem = cartManager.getItem(product.id);

    return `
        <div class="product-card scroll-animate fade-up">
            ${hasDiscount ? `<div class="product-badge">-${discountPercent}% OFF</div>` : (product.badge ? `<div class="product-badge">${product.badge}</div>` : '')}
            <a href="#/product/${product.slug || product.id}" class="product-image-container">
                <img src="${imageUrl}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='${getPlaceholderImage(product.name)}'">
            </a>
            <div class="product-info">
                <a href="#/product/${product.slug || product.id}">
                    <h3 class="product-title">${product.name}</h3>
                </a>
                <div class="product-price-row">
                    <span class="price">${formatPrice(product.price)}</span>
                    ${hasDiscount ? `<span class="compare-price">${formatPrice(product.compare_price)}</span>` : ''}
                </div>
                <div class="card-action-wrap" data-product-id="${product.id}">
                    ${cartItem && cartItem.quantity > 0 ? `
                        <div class="card-qty-controller">
                            <button class="card-qty-btn minus" onclick="event.preventDefault(); event.stopPropagation(); window.updateCardQty('${product.id}', -1)">−</button>
                            <span class="card-qty-value">${cartItem.quantity}</span>
                            <button class="card-qty-btn plus" onclick="event.preventDefault(); event.stopPropagation(); window.updateCardQty('${product.id}', 1)">+</button>
                        </div>
                    ` : `
                        <button class="btn-card-add" onclick="event.preventDefault(); event.stopPropagation(); window.addCardToCart('${product.id}')">
                            Add to Cart 🛒
                        </button>
                    `}
                </div>
            </div>
        </div>
    `;
};

// Fallback Products if API is temporarily unavailable
const getMockProducts = () => [
    { id: '1', slug: 'custom-18k-gold-plated-name-necklace', name: 'Custom 18K Gold Plated Name Necklace', price: 999, compare_price: 1499, category: 'personalized-gifts', is_featured: 1 },
    { id: '2', slug: 'romantic-led-glowing-photo-frame', name: 'Romantic LED Glowing Photo Frame', price: 1199, compare_price: 1699, category: 'photo-gifts', is_featured: 1 },
    { id: '3', slug: 'magic-temperature-color-changing-photo-mug', name: 'Magic Color Changing Photo Mug', price: 499, compare_price: 799, category: 'mugs-bottles', is_featured: 1 },
    { id: '4', slug: 'real-dried-flower-resin-letter-keychain', name: 'Real Dried Flower Resin Initial Keychain', price: 299, compare_price: 499, category: 'keychains', is_featured: 1 },
    { id: '5', slug: 'personalized-3d-moon-lamp-with-wooden-base', name: 'Personalized 3D Moon Lamp (16 Colors)', price: 1299, compare_price: 1899, category: 'home-decor', is_featured: 1 },
    { id: '6', slug: 'royal-anniversary-luxury-gift-hamper-box', name: 'Royal Luxury Anniversary Gift Hamper', price: 2499, compare_price: 3499, category: 'combo-sets', is_featured: 1 },
    { id: '7', slug: 'custom-spotify-song-acrylic-plaque-with-stand', name: 'Custom Spotify Song Acrylic Plaque', price: 899, compare_price: 1299, category: 'personalized-gifts', is_featured: 1 },
    { id: '8', slug: 'mr-and-mrs-ceramic-couple-coffee-mug-set', name: 'Mr & Mrs Ceramic Couple Coffee Mugs', price: 699, compare_price: 999, category: 'mugs-bottles', is_featured: 0 }
];

// --- Scroll Animations ---
const initScrollAnimations = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.scroll-animate:not(.animate-in)').forEach(el => {
        observer.observe(el);
    });
};

// --- Page Renderers ---

const renderHome = async () => {
    let result = await api.getProducts('limit=30');
    let products = (result && result.products) ? result.products : getMockProducts();

    const featuredGrid = document.getElementById('featuredProducts');
    const newArrivalsGrid = document.getElementById('newArrivals');

    if (featuredGrid) {
        const featured = products.filter(p => p.is_featured === 1 || p.is_featured === true);
        const displayFeatured = featured.length >= 4 ? featured.slice(0, 12) : products.slice(0, 12);
        featuredGrid.innerHTML = displayFeatured.map(p => createProductCard(p)).join('');
    }

    if (newArrivalsGrid) {
        newArrivalsGrid.innerHTML = products.slice(0, 12).map(p => createProductCard(p)).join('');
    }

    cartManager.syncAllCardButtons();
    setTimeout(initScrollAnimations, 100);
};

const renderCategory = async (slug) => {
    state.currentCategorySlug = slug;
    const readableTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const titleEl = document.getElementById('categoryTitle');
    const descEl = document.getElementById('categoryDesc');
    if (titleEl) titleEl.textContent = readableTitle;
    if (descEl) descEl.textContent = `Explore our lovely handcrafted collection of ${readableTitle} customized with love.`;

    const container = document.getElementById('categoryProducts');
    if (!container) return;
    container.innerHTML = `<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;

    let sortParam = state.currentCategorySort || 'newest';
    let res = await api.getProducts(`category=${slug}&sort=${sortParam}`);
    let products = res?.products;

    if (!products || products.length === 0) {
        products = getMockProducts().filter(p => p.category === slug || slug === 'all');
    }

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100" style="grid-column: 1/-1; padding: 60px 20px; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 12px;">🎁</div>
                <h3>No gifts found in this category yet</h3>
                <p style="color:var(--color-text-muted); margin-top:8px;">Check back soon or message our artisan on WhatsApp for custom designs!</p>
                <a href="#/" class="btn btn-primary mt-4">Browse All Gifts</a>
            </div>
        `;
    } else {
        container.innerHTML = products.map(p => createProductCard(p)).join('');
    }

    cartManager.syncAllCardButtons();
    setTimeout(initScrollAnimations, 100);
};

const renderProduct = async (slug) => {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center; padding: 100px; color:var(--color-text-muted);">Loading gift details... ⏳</div>`;

    let product = await api.getProduct(slug);
    if (!product) {
        product = getMockProducts().find(p => p.slug === slug || p.id === slug) || getMockProducts()[0];
    }

    state.productsCache[product.id] = product;
    
    let imageUrl = getPlaceholderImage(product.name);
    if (product.images && product.images.length > 0) {
        imageUrl = product.images[0].startsWith('http') ? product.images[0] : `${CONFIG.UPLOADS_BASE}/${product.images[0]}`;
    }

    const hasDiscount = product.compare_price && product.compare_price > product.price;
    const currentInCart = cartManager.getItem(product.id);
    const initialQty = currentInCart ? currentInCart.quantity : 1;

    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-gallery scroll-animate fade-up">
                <img src="${imageUrl}" alt="${product.name}" class="main-image" onerror="this.onerror=null;this.src='${getPlaceholderImage(product.name)}'">
            </div>
            <div class="product-info-detail scroll-animate fade-up" style="animation-delay: 0.15s">
                <h1 class="detail-title">${product.name}</h1>
                <div class="detail-price">
                    ${formatPrice(product.price)}
                    ${hasDiscount ? `<span class="compare-price" style="font-size: 1.25rem; margin-left: 12px; color:var(--color-text-muted); text-decoration:line-through;">${formatPrice(product.compare_price)}</span>` : ''}
                </div>
                <p class="detail-desc" style="line-height:1.7; margin: 18px 0; color:var(--color-text-dark);">${product.description || 'A stunning handcrafted gift personalized with love. Premium materials, durable finish, and customized to perfection for your unforgettable moments.'}</p>
                
                <div style="margin: 20px 0;">
                    <label style="display:block; font-weight:600; margin-bottom:8px; font-size:0.9rem;">Select Quantity:</label>
                    <div class="qty-selector" style="display:inline-flex; align-items:center; border:2px solid var(--color-border); border-radius:var(--radius-sm); overflow:hidden; background:white;">
                        <button type="button" class="qty-btn" id="pdMinusBtn" style="width:40px; height:42px; border:none; background:transparent; font-size:1.2rem; cursor:pointer; font-weight:bold;">−</button>
                        <input type="number" id="pdQty" class="qty-input" value="${initialQty}" min="1" readonly style="width:50px; height:42px; text-align:center; border:none; font-weight:bold; font-size:1rem;">
                        <button type="button" class="qty-btn" id="pdPlusBtn" style="width:40px; height:42px; border:none; background:transparent; font-size:1.2rem; cursor:pointer; font-weight:bold;">+</button>
                    </div>
                </div>
                
                <div class="action-buttons" style="display:flex; gap:12px; flex-wrap:wrap; margin-top:20px;">
                    <button class="btn btn-primary" id="pdAddBtn" style="flex:2; padding:15px; font-size:1.05rem;">
                        Add to Cart 🛍️
                    </button>
                    <a id="pdWhatsAppOrderBtn" target="_blank" class="btn btn-outline" style="flex:1; border-color:#25D366; color:#25D366; display:flex; align-items:center; justify-content:center; gap:6px;">
                        WhatsApp 💬
                    </a>
                </div>
                
                <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--color-border); display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
                        <span style="font-size:1.4rem">🚚</span> Free Express Delivery above ₹499
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
                        <span style="font-size:1.4rem">✨</span> 100% Customized Handcrafted Quality
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; font-size:0.9rem;">
                        <span style="font-size:1.4rem">🛡️</span> Safe Shockproof Packaging
                    </div>
                </div>
            </div>
        </div>
    `;

    // Connect detail quantity controls
    const qtyInput = document.getElementById('pdQty');
    const updateWhatsAppLink = () => {
        const q = parseInt(qtyInput.value) || 1;
        const msg = `Hi Sindhyaaz Crafts! 👋 I want to order:\n🎁 *${product.name}*\n📦 Quantity: ${q}\n💰 Total: ₹${product.price * q}\nPlease guide me on personalization and photos!`;
        document.getElementById('pdWhatsAppOrderBtn').href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    };

    document.getElementById('pdMinusBtn').addEventListener('click', () => {
        const cur = parseInt(qtyInput.value) || 1;
        if (cur > 1) {
            qtyInput.value = cur - 1;
            updateWhatsAppLink();
        }
    });

    document.getElementById('pdPlusBtn').addEventListener('click', () => {
        const cur = parseInt(qtyInput.value) || 1;
        qtyInput.value = cur + 1;
        updateWhatsAppLink();
    });

    document.getElementById('pdAddBtn').addEventListener('click', () => {
        const q = parseInt(qtyInput.value) || 1;
        cartManager.add(product, q);
        const btn = document.getElementById('pdAddBtn');
        const orig = btn.innerHTML;
        btn.innerHTML = 'Added to Cart! 🎉';
        btn.style.background = 'var(--color-success)';
        setTimeout(() => {
            btn.innerHTML = orig;
            btn.style.background = '';
        }, 1500);
    });

    updateWhatsAppLink();

    // Related products
    const relatedContainer = document.getElementById('relatedProducts');
    if (relatedContainer) {
        let relatedResult = await api.getProducts('limit=4');
        let related = (relatedResult?.products || getMockProducts()).slice(0, 4);
        relatedContainer.innerHTML = related.map(p => createProductCard(p)).join('');
        cartManager.syncAllCardButtons();
    }

    setTimeout(initScrollAnimations, 100);
};

const renderCart = () => {
    const container = document.getElementById('cartContainer');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100" style="grid-column: 1/-1; padding: 60px 20px; text-align: center;">
                <div style="font-size: 3.5rem; margin-bottom: 16px;">🛒</div>
                <h2>Your Shopping Cart is Empty</h2>
                <p style="color:var(--color-text-muted); margin: 12px 0 24px;">Discover unique handcrafted gifts made specially for your loved ones.</p>
                <a href="#/" class="btn btn-primary" style="padding: 12px 28px;">Start Shopping 🛍️</a>
            </div>
        `;
        return;
    }

    const subtotal = cartManager.getTotal();
    const isFreeShipping = subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD;
    const shipping = isFreeShipping ? 0 : 50;
    const total = subtotal + shipping;

    const progress = Math.min(100, Math.round((subtotal / CONFIG.FREE_SHIPPING_THRESHOLD) * 100));

    container.innerHTML = `
        <div class="cart-items">
            <!-- Free Shipping Progress Tracker -->
            <div style="background: white; padding: 18px 22px; border-radius: var(--radius-md); margin-bottom: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border);">
                <p style="margin-bottom: 10px; font-weight: 600; font-size: 0.95rem;">
                    ${isFreeShipping ? '🎉 Congratulations! You have unlocked FREE Express Delivery!' : `Add ${formatPrice(CONFIG.FREE_SHIPPING_THRESHOLD - subtotal)} more to get FREE Delivery!`}
                </p>
                <div style="height: 10px; background: var(--color-bg); border-radius: var(--radius-full); overflow: hidden;">
                    <div style="height: 100%; width: ${progress}%; background: ${isFreeShipping ? 'var(--color-success)' : 'var(--color-primary)'}; transition: width 0.3s ease;"></div>
                </div>
            </div>

            <!-- Items List -->
            ${state.cart.map(item => `
                <div class="cart-item" style="display:flex; align-items:center; gap:16px; background:white; padding:16px; border-radius:var(--radius-md); margin-bottom:14px; box-shadow:var(--shadow-sm); border:1px solid var(--color-border);">
                    <img src="${item.image}" alt="${item.name}" style="width:75px; height:75px; border-radius:var(--radius-sm); object-fit:cover;" onerror="this.onerror=null;this.src='${getPlaceholderImage(item.name)}'">
                    <div style="flex:1;">
                        <a href="#/product/${item.slug || item.id}" style="color:var(--color-text-dark); text-decoration:none; font-weight:600; font-size:0.95rem; display:block; margin-bottom:4px;">
                            ${item.name}
                        </a>
                        <div style="color:var(--color-primary); font-weight:700;">${formatPrice(item.price)}</div>
                    </div>
                    <div class="card-qty-controller" style="width:110px;">
                        <button class="card-qty-btn minus" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity - 1})">−</button>
                        <span class="card-qty-value">${item.quantity}</span>
                        <button class="card-qty-btn plus" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    </div>
                    <div style="font-weight:700; min-width:80px; text-align:right;">
                        ${formatPrice(item.price * item.quantity)}
                    </div>
                    <button type="button" class="remove-btn" onclick="cartManager.remove('${item.id}')" title="Remove item" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--color-error); padding:6px;">
                        🗑️
                    </button>
                </div>
            `).join('')}
        </div>

        <div class="cart-summary">
            <div class="summary-box" style="background:white; padding:26px; border-radius:var(--radius-md); box-shadow:var(--shadow-sm); border:1px solid var(--color-border);">
                <h3 style="margin-bottom: 20px; font-family: var(--font-heading)">Order Summary</h3>
                <div class="summary-row" style="display:flex; justify-content:space-between; margin-bottom:12px; color:var(--color-text-muted);">
                    <span>Subtotal (${cartManager.getCount()} items)</span>
                    <span style="font-weight:600; color:var(--color-text-dark);">${formatPrice(subtotal)}</span>
                </div>
                <div class="summary-row" style="display:flex; justify-content:space-between; margin-bottom:12px; color:var(--color-text-muted);">
                    <span>Shipping</span>
                    <span style="font-weight:600; color:${isFreeShipping ? 'var(--color-success)' : 'var(--color-text-dark)'};">
                        ${isFreeShipping ? 'FREE' : formatPrice(shipping)}
                    </span>
                </div>
                <div class="summary-total" style="display:flex; justify-content:space-between; padding-top:16px; margin-top:12px; border-top:1px solid var(--color-border); font-size:1.2rem; font-weight:700;">
                    <span>Total Amount</span>
                    <span style="color:var(--color-primary);">${formatPrice(total)}</span>
                </div>
                <a href="#/checkout" class="btn btn-primary w-100" style="margin-top:22px; padding:14px; font-size:1.05rem; display:block; text-align:center;">
                    Proceed to Checkout 🔒
                </a>
                <p style="text-align:center; font-size:0.8rem; margin-top:14px; color:var(--color-text-muted);">
                    🛡️ 100% Buyer Protection & Safe Payments
                </p>
            </div>
        </div>
    `;
};

const renderCheckout = () => {
    const container = document.getElementById('checkoutContainer');
    if (!container) return;

    if (state.cart.length === 0) {
        window.location.hash = '#/cart';
        return;
    }

    const subtotal = cartManager.getTotal();
    const isFreeShipping = subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD;
    const shipping = isFreeShipping ? 0 : 50;
    const total = subtotal + shipping;

    const user = state.user || {};
    const nameParts = (user.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    container.innerHTML = `
        <div class="checkout-form-container" style="background: white; padding: 28px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border:1px solid var(--color-border);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="font-family:var(--font-heading); margin:0;">Shipping & Delivery Details</h3>
                ${!state.user ? `
                    <button type="button" onclick="window.openUserModal()" style="background:transparent; border:none; color:var(--color-primary); font-weight:600; cursor:pointer; font-size:0.88rem;">
                        Have an account? Sign In 👤
                    </button>
                ` : `
                    <span style="color:var(--color-success); font-size:0.85rem; font-weight:600;">✓ Signed in as ${state.user.name}</span>
                `}
            </div>

            <form id="checkoutForm" onsubmit="window.handlePlaceOrder(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom:14px;">
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">First Name *</label>
                        <input type="text" name="firstName" value="${firstName}" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Last Name</label>
                        <input type="text" name="lastName" value="${lastName}" class="form-control" style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom:14px;">
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Phone / WhatsApp * (10 Digits)</label>
                        <input type="tel" name="phone" value="${user.phone || ''}" placeholder="9876543210" pattern="[0-9]{10}" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Email Address (For Invoices)</label>
                        <input type="email" name="email" value="${user.email || ''}" placeholder="name@example.com" class="form-control" style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Street Address / House No. *</label>
                    <input type="text" name="address1" placeholder="Flat No., Building Name, Street" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                </div>

                <div style="margin-bottom:14px;">
                    <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Landmark / Area (Optional)</label>
                    <input type="text" name="address2" placeholder="Near Temple / School / Bus Stop" class="form-control" style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom:24px;">
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">City / Town *</label>
                        <input type="text" name="city" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">State *</label>
                        <input type="text" name="state" placeholder="Tamil Nadu" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                    <div>
                        <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Pincode *</label>
                        <input type="text" name="pincode" placeholder="600001" pattern="[0-9]{6}" class="form-control" required style="width:100%; padding:11px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;">
                    </div>
                </div>

                <h3 style="font-family:var(--font-heading); margin-bottom:16px;">Payment Method</h3>
                <div style="border: 2px solid var(--color-primary); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 14px; background: rgba(232, 121, 160, 0.05);">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight:600;">
                        <input type="radio" name="payment_method" value="cod" checked style="accent-color:var(--color-primary); width:18px; height:18px;">
                        <span>Cash on Delivery (COD) 💵</span>
                    </label>
                    <p style="margin: 6px 0 0 30px; font-size:0.82rem; color:var(--color-text-muted);">Pay with cash upon delivery at your doorstep.</p>
                </div>

                <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 24px; background: white;">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight:600;">
                        <input type="radio" name="payment_method" value="online" style="accent-color:var(--color-primary); width:18px; height:18px;">
                        <span>Pay via UPI / GPay / PhonePe / WhatsApp 📲</span>
                    </label>
                    <p style="margin: 6px 0 0 30px; font-size:0.82rem; color:var(--color-text-muted);">Direct UPI payment verification via WhatsApp upon order placement.</p>
                </div>

                <div style="margin-bottom:20px;">
                    <label class="form-label" style="display:block; margin-bottom:6px; font-weight:600; font-size:0.85rem;">Customization Notes (Optional)</label>
                    <textarea name="notes" rows="2" placeholder="Mention recipient names, dates, or special notes for our artisan" class="form-control" style="width:100%; padding:10px 14px; border:1px solid var(--color-border); border-radius:var(--radius-sm); font-family:inherit;"></textarea>
                </div>

                <button type="submit" id="submitOrderBtn" class="btn btn-primary w-100" style="font-size: 1.1rem; padding: 15px;">
                    Place Order (${formatPrice(total)}) 🔒
                </button>
            </form>
        </div>

        <div class="checkout-summary">
            <div class="summary-box" style="background: white; padding: 26px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border:1px solid var(--color-border);">
                <h3 style="margin-bottom: 20px; font-family: var(--font-heading)">Order Summary</h3>
                <div style="max-height: 280px; overflow-y: auto; margin-bottom: 20px; padding-right: 6px;">
                    ${state.cart.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 0.9rem;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <img src="${item.image}" alt="${item.name}" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onerror="this.onerror=null;this.src='${getPlaceholderImage(item.name)}'">
                                <div>
                                    <div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight:600;">${item.name}</div>
                                    <div style="color:var(--color-text-muted); font-size:0.8rem;">Qty: ${item.quantity} × ${formatPrice(item.price)}</div>
                                </div>
                            </div>
                            <span style="font-weight: 700;">${formatPrice(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>

                <div style="border-top: 1px solid var(--color-border); padding-top: 16px;">
                    <div class="summary-row" style="display:flex; justify-content:space-between; margin-bottom:10px; color:var(--color-text-muted);">
                        <span>Subtotal</span>
                        <span>${formatPrice(subtotal)}</span>
                    </div>
                    <div class="summary-row" style="display:flex; justify-content:space-between; margin-bottom:10px; color:var(--color-text-muted);">
                        <span>Shipping</span>
                        <span style="color:${isFreeShipping ? 'var(--color-success)' : 'inherit'}; font-weight:600;">
                            ${isFreeShipping ? 'FREE' : formatPrice(shipping)}
                        </span>
                    </div>
                    <div class="summary-total" style="display:flex; justify-content:space-between; font-size:1.2rem; font-weight:700; padding-top:12px; border-top:1px solid var(--color-border);">
                        <span>Total to Pay</span>
                        <span style="color:var(--color-primary);">${formatPrice(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
};

// Checkout Order Submission
window.handlePlaceOrder = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitOrderBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = 'Placing Order... ⏳';

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    const subtotal = cartManager.getTotal();
    const shipping = subtotal >= CONFIG.FREE_SHIPPING_THRESHOLD ? 0 : 50;
    const total = subtotal + shipping;

    const payload = {
        customer_name: `${data.firstName || ''} ${data.lastName || ''}`.trim(),
        phone: (data.phone || '').trim(),
        email: (data.email || '').trim() || null,
        address: `${data.address1 || ''} ${data.address2 || ''}`.trim(),
        city: (data.city || '').trim(),
        state: (data.state || '').trim(),
        pincode: (data.pincode || '').trim(),
        notes: (data.notes || '').trim() || null,
        items: state.cart,
        subtotal,
        shipping,
        total,
        payment_status: data.payment_method === 'cod' ? 'pending (cod)' : 'pending (online)'
    };

    const res = await api.createOrder(payload);

    if (res && res.order_number) {
        const orderNumber = res.order_number;
        
        // Save order locally for quick reference
        const myOrders = JSON.parse(localStorage.getItem('sindhyaaz_my_orders') || '[]');
        myOrders.unshift({
            order_number: orderNumber,
            date: new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }),
            total,
            items: state.cart
        });
        localStorage.setItem('sindhyaaz_my_orders', JSON.stringify(myOrders));

        cartManager.clear();

        const container = document.getElementById('checkoutContainer');
        container.innerHTML = `
            <div class="empty-state w-100" style="grid-column: 1/-1; padding: 50px 20px; text-align: center; background: white; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--color-border);">
                <div style="font-size: 4rem; margin-bottom: 12px;">🎉</div>
                <h2 style="font-family: var(--font-heading); color: var(--color-text-dark); margin-bottom: 8px;">Order Placed Successfully!</h2>
                <p style="font-size: 1.15rem; color: var(--color-primary); font-weight: 700; margin-bottom: 12px;">
                    Order Number: <span style="background:var(--color-bg); padding:4px 12px; border-radius:var(--radius-sm);">${orderNumber}</span>
                </p>
                <p style="color: var(--color-text-muted); max-width: 500px; margin: 0 auto 28px; line-height: 1.6;">
                    Thank you <strong>${payload.customer_name}</strong>! We have received your order of <strong>${formatPrice(total)}</strong>. Our artisan will process it right away. You will receive updates via WhatsApp/SMS!
                </p>
                
                <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary" onclick="window.openTrackOrderModal('${orderNumber}')" style="padding:12px 24px;">
                        Track Order 📦
                    </button>
                    <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=Hi%20Sindhyaaz%20Crafts!%20I%20just%20placed%20order%20*${orderNumber}*%20for%20₹${total}." target="_blank" class="btn btn-outline" style="border-color:#25D366; color:#25D366; padding:12px 24px;">
                        WhatsApp Confirmation 💬
                    </a>
                    <a href="#/" class="btn btn-white" style="padding:12px 24px;">
                        Continue Shopping 🛍️
                    </a>
                </div>
            </div>
        `;
        showToast('Order confirmed! 🎉');
    } else {
        btn.disabled = false;
        btn.innerHTML = `Place Order (${formatPrice(total)}) 🔒`;
        showToast('Failed to place order. Please check all required fields and try again.', 'error');
    }
};

const renderSearch = async (query) => {
    const titleEl = document.getElementById('searchTitle');
    if (titleEl) titleEl.textContent = query ? `Search Results for "${query}"` : 'All Handcrafted Gifts';

    const container = document.getElementById('searchResults');
    if (!container) return;
    container.innerHTML = `<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;

    let res = await api.getProducts(query ? `search=${encodeURIComponent(query)}` : '');
    let products = res?.products;

    if (!products) {
        products = getMockProducts();
        if (query) {
            const q = query.toLowerCase();
            products = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
        }
    }

    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100" style="grid-column: 1/-1; padding: 60px 20px; text-align: center;">
                <div style="font-size: 3rem; margin-bottom: 12px;">🔍</div>
                <h3>No gifts matched "${query}"</h3>
                <p style="color:var(--color-text-muted); margin: 8px 0 20px;">Try searching for "necklace", "frame", "mug", "keychain", or "lamp".</p>
                <a href="#/" class="btn btn-primary">Browse All Gifts</a>
            </div>
        `;
    } else {
        container.innerHTML = products.map(p => createProductCard(p)).join('');
    }

    cartManager.syncAllCardButtons();
    setTimeout(initScrollAnimations, 100);
};

// --- Customer Auth UI & Actions ---
const updateAuthUI = () => {
    const nameDisplay = document.getElementById('userNameDisplay');
    const userBtn = document.getElementById('userBtn');

    if (state.user && state.user.name) {
        const firstName = state.user.name.split(' ')[0];
        if (nameDisplay) nameDisplay.textContent = firstName;
        if (userBtn) userBtn.title = `Signed in as ${state.user.name}`;
    } else {
        if (nameDisplay) nameDisplay.textContent = 'Sign In';
        if (userBtn) userBtn.title = 'Account / Sign In';
    }
};

window.openUserModal = () => {
    const modal = document.getElementById('userModal');
    if (!modal) return;
    modal.classList.add('active');

    const authForms = document.getElementById('authFormsContainer');
    const profileContainer = document.getElementById('userProfileContainer');

    if (state.user) {
        if (authForms) authForms.style.display = 'none';
        if (profileContainer) profileContainer.style.display = 'block';

        const nameEl = document.getElementById('profileName');
        const emailEl = document.getElementById('profileEmail');
        const initialsEl = document.getElementById('profileAvatarInitials');

        if (nameEl) nameEl.textContent = state.user.name;
        if (emailEl) emailEl.textContent = state.user.email;
        if (initialsEl) initialsEl.textContent = (state.user.name || 'U').charAt(0).toUpperCase();

        window.loadUserOrders();
    } else {
        if (authForms) authForms.style.display = 'block';
        if (profileContainer) profileContainer.style.display = 'none';
        window.switchAuthTab('login');
    }
};

window.closeUserModal = () => {
    const modal = document.getElementById('userModal');
    if (modal) modal.classList.remove('active');
};

window.switchAuthTab = (tab) => {
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const title = document.getElementById('authModalTitle');

    if (tab === 'login') {
        tabSignIn?.classList.add('active');
        tabSignUp?.classList.remove('active');
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (title) title.textContent = 'Welcome Back! ✨';
    } else {
        tabSignIn?.classList.remove('active');
        tabSignUp?.classList.add('active');
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (title) title.textContent = 'Join Sindhyaaz Crafts 🌸';
    }
};

window.handleUserLogin = async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const res = await api.loginUser(email, password);
    if (res && res.token) {
        state.token = res.token;
        state.user = res.user;
        localStorage.setItem('sindhyaaz_token', res.token);
        localStorage.setItem('sindhyaaz_user', JSON.stringify(res.user));
        updateAuthUI();
        window.closeUserModal();
        showToast(`Welcome back, ${res.user.name}! 🌟`);
    } else {
        showToast('Invalid email or password. Please try again.', 'error');
    }
};

window.handleUserRegister = async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;

    const res = await api.registerUser(name, email, password, phone);
    if (res && res.token) {
        state.token = res.token;
        state.user = res.user;
        localStorage.setItem('sindhyaaz_token', res.token);
        localStorage.setItem('sindhyaaz_user', JSON.stringify(res.user));
        updateAuthUI();
        window.closeUserModal();
        showToast(`Account created! Welcome, ${res.user.name}! 🎉`);
    } else {
        showToast('Registration failed. Please try a different email.', 'error');
    }
};

window.handleGoogleLogin = async () => {
    // Interactive Google Sign-In prompt
    const simulatedEmail = prompt("Enter your Google Email to sign in with Google:", state.user?.email || "customer@gmail.com");
    if (!simulatedEmail || !simulatedEmail.includes('@')) return;

    const simulatedName = simulatedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const res = await api.googleLogin(simulatedName, simulatedEmail, `google_${Date.now()}`);

    if (res && res.token) {
        state.token = res.token;
        state.user = res.user;
        localStorage.setItem('sindhyaaz_token', res.token);
        localStorage.setItem('sindhyaaz_user', JSON.stringify(res.user));
        updateAuthUI();
        window.closeUserModal();
        showToast(`Signed in with Google as ${res.user.name}! 🚀`);
    } else {
        showToast('Google sign-in could not be completed.', 'error');
    }
};

window.handleUserLogout = () => {
    state.user = null;
    state.token = null;
    localStorage.removeItem('sindhyaaz_user');
    localStorage.removeItem('sindhyaaz_token');
    updateAuthUI();
    window.closeUserModal();
    showToast('Signed out successfully.');
};

window.loadUserOrders = async () => {
    const list = document.getElementById('userOrdersList');
    const badge = document.getElementById('orderCountBadge');
    if (!list) return;

    list.innerHTML = `<p style="text-align:center; padding:15px; color:var(--color-text-muted);">Fetching your orders... ⏳</p>`;

    let orders = await api.getUserOrders();
    if (!orders || orders.length === 0) {
        orders = JSON.parse(localStorage.getItem('sindhyaaz_my_orders') || '[]');
    }

    if (badge) badge.textContent = `${orders.length} orders`;

    if (orders.length === 0) {
        list.innerHTML = `<p style="text-align:center; color:var(--color-text-muted); padding:20px 0; font-size:0.9rem;">No orders yet. Start shopping! 🎁</p>`;
        return;
    }

    list.innerHTML = orders.map(o => `
        <div class="order-history-card">
            <div class="order-history-header">
                <span>#${o.order_number}</span>
                <span class="order-history-badge badge-${(o.order_status || 'pending').toLowerCase()}">${o.order_status || 'Pending'}</span>
            </div>
            <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:6px;">
                Placed: ${o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : (o.date || 'Recent')}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.92rem; font-weight:700;">
                <span>Total: ${formatPrice(o.total)}</span>
                <button type="button" class="btn btn-outline" style="padding:4px 10px; font-size:0.8rem;" onclick="window.openTrackOrderModal('${o.order_number}')">
                    Track 📦
                </button>
            </div>
        </div>
    `).join('');
};

// --- Track Order Modal Handlers ---
window.openTrackOrderModal = (orderNumber = '') => {
    const modal = document.getElementById('trackOrderModal');
    if (!modal) return;
    modal.classList.add('active');

    const input = document.getElementById('trackOrderInput');
    const resultDiv = document.getElementById('trackOrderResult');
    if (resultDiv) resultDiv.style.display = 'none';

    if (orderNumber && input) {
        input.value = orderNumber;
        window.handleTrackOrder({ preventDefault: () => {} });
    }
};

window.closeTrackOrderModal = () => {
    const modal = document.getElementById('trackOrderModal');
    if (modal) modal.classList.remove('active');
};

window.handleTrackOrder = async (e) => {
    e.preventDefault();
    const input = document.getElementById('trackOrderInput');
    const resultDiv = document.getElementById('trackOrderResult');
    if (!input || !resultDiv) return;

    const orderNum = input.value.trim();
    if (!orderNum) return;

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `<p style="text-align:center; padding:20px; color:var(--color-text-muted);">Looking up order <strong>${orderNum}</strong>... ⏳</p>`;

    const order = await api.trackOrder(orderNum);
    if (!order) {
        resultDiv.innerHTML = `
            <div style="background:var(--color-bg); padding:20px; border-radius:var(--radius-sm); text-align:center;">
                <p style="color:var(--color-error); font-weight:600; margin-bottom:8px;">❌ Order not found</p>
                <p style="color:var(--color-text-muted); font-size:0.9rem;">Please verify your Order Number (e.g. GL-20261110-XXXX) or chat with us on WhatsApp for assistance.</p>
                <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=Hi%20Sindhyaaz%20Crafts!%20Can%20you%20help%20me%20track%20order%20*${orderNum}*?" target="_blank" class="btn btn-outline" style="margin-top:12px; border-color:#25D366; color:#25D366;">
                    Ask Support on WhatsApp 💬
                </a>
            </div>
        `;
        return;
    }

    const status = (order.order_status || 'pending').toLowerCase();
    const isStep1 = true;
    const isStep2 = ['processing', 'shipped', 'delivered'].includes(status);
    const isStep3 = ['shipped', 'delivered'].includes(status);
    const isStep4 = status === 'delivered';

    resultDiv.innerHTML = `
        <div style="background:var(--color-bg); padding:20px; border-radius:var(--radius-sm); border:1px solid var(--color-border); margin-top:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <div>
                    <h4 style="margin:0; font-size:1.1rem; color:var(--color-text-dark);">Order #${order.order_number}</h4>
                    <span style="font-size:0.85rem; color:var(--color-text-muted);">Customer: ${order.customer_name}</span>
                </div>
                <span class="order-history-badge badge-${status}">${order.order_status}</span>
            </div>

            <!-- Visual Stepper -->
            <div class="tracking-steps">
                <div class="step-item ${isStep1 ? 'completed' : ''}">
                    <div class="step-icon">📝</div>
                    <div class="step-label">Order Placed</div>
                </div>
                <div class="step-item ${isStep2 ? 'completed' : (status === 'pending' ? 'active' : '')}">
                    <div class="step-icon">🎨</div>
                    <div class="step-label">Crafting</div>
                </div>
                <div class="step-item ${isStep3 ? 'completed' : (status === 'processing' ? 'active' : '')}">
                    <div class="step-icon">🚚</div>
                    <div class="step-label">Dispatched</div>
                </div>
                <div class="step-item ${isStep4 ? 'completed' : ''}">
                    <div class="step-icon">🎉</div>
                    <div class="step-label">Delivered</div>
                </div>
            </div>

            <div style="background:white; padding:14px; border-radius:var(--radius-sm); margin-top:16px; font-size:0.9rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="color:var(--color-text-muted);">Total Amount:</span>
                    <strong>${formatPrice(order.total)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span style="color:var(--color-text-muted);">Payment:</span>
                    <span style="text-transform:capitalize;">${order.payment_status || 'Pending'}</span>
                </div>
            </div>

            <div style="text-align:center; margin-top:16px;">
                <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=Hi%20Sindhyaaz%20Crafts!%20Inquiring%20about%20order%20*${order.order_number}*." target="_blank" class="btn btn-outline" style="border-color:#25D366; color:#25D366; font-size:0.9rem; padding:8px 18px;">
                    Chat with Support on WhatsApp 💬
                </a>
            </div>
        </div>
    `;
};

// --- FAQ, Policies, Contact Modal Handlers ---
window.openFaqModal = () => {
    document.getElementById('faqModal')?.classList.add('active');
};
window.closeFaqModal = () => {
    document.getElementById('faqModal')?.classList.remove('active');
};

const policyContents = {
    shipping: `
        <h4 style="margin-bottom:10px;">🚚 Shipping & Express Delivery Policy</h4>
        <p>At <strong>Sindhyaaz Crafts & Handmade</strong>, every gift is treated with immense care and artistic dedication.</p>
        <ul style="margin: 12px 0 16px 20px; line-height: 1.8;">
            <li><strong>Processing Time:</strong> Ready-to-ship items ship within 24 hours. Custom personalized gifts (photo engraving, names, custom resin) take 24 to 48 hours for handcrafted creation and curing.</li>
            <li><strong>Delivery Timelines:</strong> Standard express transit takes <strong>3 to 5 business days</strong> across all major towns and cities in India.</li>
            <li><strong>Shipping Rates:</strong> We offer <strong>FREE Delivery</strong> on all orders above ₹499! For orders below ₹499, a flat nominal delivery fee of ₹50 applies.</li>
            <li><strong>Tracking:</strong> Real-time tracking numbers with live tracking links are shared via WhatsApp and SMS immediately upon package handover to our express courier partner.</li>
        </ul>
    `,
    return: `
        <h4 style="margin-bottom:10px;">🔄 Return & 100% Replacement Guarantee</h4>
        <p>Your joy and satisfaction are our highest priority!</p>
        <ul style="margin: 12px 0 16px 20px; line-height: 1.8;">
            <li><strong>Damage Replacement Guarantee:</strong> Because customized gifts are tailored with personal names and photos, they cannot be returned for a change of mind. However, if your gift arrives defective, damaged, or contains an engraving error, we provide an <strong>instant 100% FREE replacement</strong>!</li>
            <li><strong>How to Claim:</strong> Record a quick video while unboxing your parcel and WhatsApp it to <strong>+91 8098587377</strong> within 48 hours of delivery.</li>
            <li><strong>Non-Personalized Items:</strong> Non-custom items can be returned within 7 days in original condition and packaging.</li>
        </ul>
    `,
    terms: `
        <h4 style="margin-bottom:10px;">🛡️ Privacy & Terms of Service</h4>
        <p>We respect your privacy and protect your personal memories.</p>
        <ul style="margin: 12px 0 16px 20px; line-height: 1.8;">
            <li><strong>Customer Photos:</strong> Any photos or names submitted for customized gifts are kept strictly confidential and permanently deleted from our working servers within 30 days of order fulfillment.</li>
            <li><strong>Payment Security:</strong> All financial transactions are protected with bank-grade 256-bit encryption. We never store credit/debit card numbers.</li>
            <li><strong>Accuracy:</strong> Please double-check spelling and uploaded photo clarity before submitting your order to ensure perfect handcrafted results!</li>
        </ul>
    `
};

window.openPolicyModal = (type = 'shipping') => {
    const modal = document.getElementById('policyModal');
    if (!modal) return;
    modal.classList.add('active');
    window.switchPolicyTab(type);
};

window.closePolicyModal = () => {
    document.getElementById('policyModal')?.classList.remove('active');
};

window.switchPolicyTab = (type) => {
    ['shipping', 'return', 'terms'].forEach(t => {
        const tabEl = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Policy`);
        if (tabEl) tabEl.classList.remove('active');
    });

    const activeTab = document.getElementById(`tab${type.charAt(0).toUpperCase() + type.slice(1)}Policy`);
    if (activeTab) activeTab.classList.add('active');

    const area = document.getElementById('policyContentArea');
    if (area) area.innerHTML = policyContents[type] || policyContents['shipping'];
};

window.openContactModal = () => {
    document.getElementById('contactModal')?.classList.add('active');
};
window.closeContactModal = () => {
    document.getElementById('contactModal')?.classList.remove('active');
};

// --- Router ---
const router = () => {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const segments = path.split('/').filter(Boolean);

    document.getElementById('mobileMenuOverlay')?.classList.remove('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (segments.length === 0) {
        document.getElementById('view-home')?.classList.add('active');
        renderHome();
    } else if (segments[0] === 'category' && segments[1]) {
        document.getElementById('view-category')?.classList.add('active');
        renderCategory(segments[1]);
    } else if (segments[0] === 'product' && segments[1]) {
        document.getElementById('view-product')?.classList.add('active');
        renderProduct(segments[1]);
    } else if (segments[0] === 'cart') {
        document.getElementById('view-cart')?.classList.add('active');
        renderCart();
    } else if (segments[0] === 'checkout') {
        document.getElementById('view-checkout')?.classList.add('active');
        renderCheckout();
    } else if (segments[0] === 'search') {
        document.getElementById('view-search')?.classList.add('active');
        const urlParams = new URLSearchParams(queryString);
        renderSearch(urlParams.get('q') || '');
    } else {
        window.location.hash = '#/';
    }

    // Bottom Navigation sync
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === `#${path}`) {
            item.classList.add('active');
        }
    });
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Router
    window.addEventListener('hashchange', router);
    router();

    // Initial Badge & Auth UI
    cartManager.updateBadge();
    updateAuthUI();

    // Header Account Buttons
    document.getElementById('userBtn')?.addEventListener('click', window.openUserModal);
    document.getElementById('mobileAccountTrigger')?.addEventListener('click', window.openUserModal);

    // Mobile Menu
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
        mobileMenuOverlay?.classList.add('active');
    });
    document.getElementById('mobileMenuTrigger')?.addEventListener('click', (e) => {
        e.preventDefault();
        mobileMenuOverlay?.classList.add('active');
    });
    document.getElementById('closeMenuBtn')?.addEventListener('click', () => {
        mobileMenuOverlay?.classList.remove('active');
    });

    // Search Bar (Desktop & Mobile)
    const handleSearch = (inputEl) => {
        const query = (inputEl?.value || '').trim();
        window.location.hash = query ? `#/search?q=${encodeURIComponent(query)}` : `#/search`;
        if (inputEl) inputEl.value = '';
    };

    document.querySelectorAll('.search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.target.closest('.search-container')?.querySelector('.search-input');
            handleSearch(input);
        });
    });

    document.querySelectorAll('.search-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch(input);
        });
    });

    // Category Page Sort Dropdown
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            let val = e.target.value;
            if (val === 'price_low') val = 'price_asc';
            if (val === 'price_high') val = 'price_desc';
            state.currentCategorySort = val;
            if (state.currentCategorySlug) {
                renderCategory(state.currentCategorySlug);
            }
        });
    }

    // Newsletter Subscription Form
    const newsletterForm = document.querySelector('.newsletter-box form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = newsletterForm.querySelector('input[type="email"]');
            const email = (input?.value || '').trim();
            if (email) {
                showToast(`Thank you! ✨ 10% coupon code sent to ${email}`);
                input.value = '';
            }
        });
    }

    // Modal background click dismissal
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.classList.remove('active');
            }
        });
    });

    // Hero Showcase Image Rotation
    setInterval(() => {
        const images = document.querySelectorAll('.showcase-img');
        if (images.length === 0) return;
        let activeIdx = Array.from(images).findIndex(img => img.classList.contains('active'));
        if (activeIdx === -1) {
            images[0].classList.add('active');
            return;
        }
        images[activeIdx].classList.remove('active');
        let nextIdx = (activeIdx + 1) % images.length;
        images[nextIdx].classList.add('active');
    }, 3600);
});
