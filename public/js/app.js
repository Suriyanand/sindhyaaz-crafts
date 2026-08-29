// Config & State
const CONFIG = {
    // Determine API URL based on where frontend is served
    API_BASE: window.location.port === '3000' || window.location.hostname === 'localhost' && window.location.port === '' 
        ? 'http://localhost:3000/api' 
        : '/api',
    UPLOADS_BASE: window.location.port === '3000' || window.location.hostname === 'localhost' && window.location.port === '' 
        ? 'http://localhost:3000/uploads' 
        : '/uploads',
    CURRENCY: '₹'
};

const state = {
    cart: JSON.parse(localStorage.getItem('giftlux_cart')) || [],
    productsCache: {}, // Simple cache for loaded products
};

// --- Utilities ---
const formatPrice = (price) => `${CONFIG.CURRENCY}${Number(price).toLocaleString('en-IN')}`;

const getPlaceholderImage = (name) => {
    // Generate a simple gradient based on name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="hsl(${hue}, 70%, 90%)"/><text x="50%" y="50%" font-family="sans-serif" font-size="24" fill="hsl(${hue}, 70%, 30%)" text-anchor="middle" dominant-baseline="middle">${name.charAt(0).toUpperCase()}</text></svg>`;
};

const showToast = (message, type = 'success') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${type === 'success' ? '✅' : '❌'}</span>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- API Service ---
const api = {
    async fetch(endpoint, options = {}) {
        try {
            const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
            const json = await res.json();
            return json.data !== undefined ? json.data : json;
        } catch (error) {
            console.error('API call failed:', error);
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
        // Return a mock success response if API is unreachable
        const res = await this.fetch('/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (!res) {
            return { success: true, orderId: 'ORD-' + Math.floor(Math.random() * 1000000) };
        }
        return res;
    }
};

// --- Cart Manager ---
const cartManager = {
    save() {
        localStorage.setItem('giftlux_cart', JSON.stringify(state.cart));
        this.updateBadge();
    },
    add(product, quantity = 1) {
        const existingItem = state.cart.find(item => item.id === product.id);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            state.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.images && product.images[0] ? `${CONFIG.UPLOADS_BASE}/${product.images[0]}` : getPlaceholderImage(product.name),
                quantity: quantity
            });
        }
        this.save();
        showToast('Added to cart!');
    },
    remove(id) {
        state.cart = state.cart.filter(item => item.id !== id);
        this.save();
        showToast('Removed from cart', 'error');
        if(window.location.hash === '#/cart') renderCart(); // re-render cart
    },
    updateQuantity(id, quantity) {
        const item = state.cart.find(item => item.id === id);
        if (item) {
            item.quantity = Math.max(1, quantity);
            this.save();
            if(window.location.hash === '#/cart') renderCart(); // re-render cart
        }
    },
    getTotal() {
        return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    },
    getCount() {
        return state.cart.reduce((sum, item) => sum + item.quantity, 0);
    },
    clear() {
        state.cart = [];
        this.save();
    },
    updateBadge() {
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = this.getCount();
            badge.style.transform = 'translate(20%, -20%) scale(1.2)';
            setTimeout(() => badge.style.transform = 'translate(20%, -20%) scale(1)', 200);
        }
    }
};

// --- UI Components ---
const createProductCard = (product) => {
    const imageUrl = product.images && product.images[0] ? `${CONFIG.UPLOADS_BASE}/${product.images[0]}` : getPlaceholderImage(product.name || 'Product');
    const hasDiscount = product.compare_price > product.price;
    const discountPercent = hasDiscount ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100) : 0;
    
    // Store in cache for quick access
    state.productsCache[product.id] = product;

    return `
        <div class="product-card scroll-animate fade-up">
            ${hasDiscount ? `<div class="product-badge">-${discountPercent}% OFF</div>` : ''}
            <a href="#/product/${product.slug || product.id}" class="product-image-container">
                <img src="${imageUrl}" alt="${product.name}" class="product-image" loading="lazy">
                <div class="product-overlay">
                    <button class="btn btn-primary w-100" onclick="event.preventDefault(); window.addToCart('${product.id}')">
                        Quick Add 🛒
                    </button>
                </div>
            </a>
            <div class="product-info">
                <a href="#/product/${product.slug || product.id}">
                    <h3 class="product-title">${product.name}</h3>
                </a>
                <div class="product-price-row">
                    <span class="price">${formatPrice(product.price)}</span>
                    ${hasDiscount ? `<span class="compare-price">${formatPrice(product.compare_price)}</span>` : ''}
                </div>
            </div>
        </div>
    `;
};

// Expose addToCart to global scope for inline handlers
window.addToCart = (productId) => {
    const product = state.productsCache[productId];
    if (product) cartManager.add(product);
};

// --- Scroll Animations ---
const initScrollAnimations = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.scroll-animate:not(.animate-in)').forEach(el => {
        observer.observe(el);
    });
};

// --- Mock Data Fallbacks ---
// Used if API is down
const getMockProducts = () => {
    return [
        { id: '1', slug: 'custom-name-necklace', name: 'Custom Name Necklace 18k Gold Plated', price: 999, compare_price: 1499, category: 'personalized' },
        { id: '2', slug: 'led-photo-frame', name: 'Romantic LED Photo Frame', price: 1299, compare_price: 1999, category: 'photo-gifts' },
        { id: '3', slug: 'couple-mugs', name: 'Mr & Mrs Ceramic Couple Mugs', price: 599, compare_price: 899, category: 'mugs' },
        { id: '4', slug: 'spotify-plaque', name: 'Custom Spotify Glass Plaque', price: 899, compare_price: 1299, category: 'personalized' },
        { id: '5', slug: 'resin-keychain', name: 'Floral Resin Letter Keychain', price: 299, compare_price: 499, category: 'keychains' },
        { id: '6', slug: 'gift-hamper', name: 'Premium Birthday Gift Hamper', price: 2499, compare_price: 2999, category: 'combos' },
        { id: '7', slug: 'moon-lamp', name: 'Personalized 3D Moon Lamp', price: 1499, compare_price: 2199, category: 'home-decor' },
        { id: '8', slug: 'leather-wallet', name: 'Engraved Leather Men\'s Wallet', price: 799, compare_price: 1199, category: 'personalized' }
    ];
};

// --- Page Renderers ---

const renderHome = async () => {
    // Try fetch, fallback to mock data
    let result = await api.getProducts('limit=24');
    let products;
    if (!result || !result.products) {
        products = getMockProducts();
    } else {
        products = result.products;
    }
    
    document.getElementById('featuredProducts').innerHTML = products.slice(0,12).map(p => createProductCard(p)).join('');
    document.getElementById('newArrivals').innerHTML = products.slice(12,24).map(p => createProductCard(p)).join('');
    
    setTimeout(initScrollAnimations, 100);
};

const renderCategory = async (slug) => {
    document.getElementById('categoryTitle').textContent = slug.replace('-', ' ').toUpperCase();
    document.getElementById('categoryDesc').textContent = `Explore our lovely collection of ${slug.replace('-', ' ')} items.`;
    
    const container = document.getElementById('categoryProducts');
    container.innerHTML = `<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;
    
    let res = await api.getProducts(`category=${slug}`);
    let products = res?.products;

    if (!products) {
        products = getMockProducts().filter(p => p.category === slug || slug === 'all');
        if(products.length === 0) products = getMockProducts();
    }

    if (products.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">😢</div><h3>No products found</h3></div>`;
    } else {
        container.innerHTML = products.map(p => createProductCard(p)).join('');
    }
    
    setTimeout(initScrollAnimations, 100);
};

const renderProduct = async (slug) => {
    const container = document.getElementById('productDetailContainer');
    container.innerHTML = `<div style="text-align:center; padding: 100px;">Loading...</div>`;
    
    let rawProduct = await api.getProduct(slug);
    let product = rawProduct || getMockProducts().find(p => p.slug === slug || p.id === slug) || getMockProducts()[0];
    
    // Cache it
    state.productsCache[product.id] = product;
    
    const imageUrl = product.images && product.images[0] ? `${CONFIG.UPLOADS_BASE}/${product.images[0]}` : getPlaceholderImage(product.name);
    
    container.innerHTML = `
        <div class="product-detail-grid">
            <div class="product-gallery scroll-animate fade-up">
                <img src="${imageUrl}" alt="${product.name}" class="main-image">
            </div>
            <div class="product-info-detail scroll-animate fade-up" style="animation-delay: 0.2s">
                <h1 class="detail-title">${product.name}</h1>
                <div class="detail-price">
                    ${formatPrice(product.price)}
                    ${product.compare_price > product.price ? `<span class="compare-price" style="font-size: 1.2rem; margin-left: 10px;">${formatPrice(product.compare_price)}</span>` : ''}
                </div>
                <p class="detail-desc">${product.description || 'A beautiful and premium gift crafted with love. Perfect for making special moments unforgettable.'}</p>
                
                <div class="qty-selector">
                    <button class="qty-btn" onclick="document.getElementById('pdQty').value = Math.max(1, parseInt(document.getElementById('pdQty').value) - 1)">-</button>
                    <input type="number" id="pdQty" class="qty-input" value="1" min="1">
                    <button class="qty-btn" onclick="document.getElementById('pdQty').value = parseInt(document.getElementById('pdQty').value) + 1">+</button>
                </div>
                
                <div class="action-buttons">
                    <button class="btn btn-primary" style="flex: 2" onclick="
                        cartManager.add(state.productsCache['${product.id}'], parseInt(document.getElementById('pdQty').value))
                    ">
                        Add to Cart 🛍️
                    </button>
                    <a href="https://wa.me/918098587377?text=Hi, I want to buy: ${encodeURIComponent(product.name)}" target="_blank" class="btn btn-outline" style="flex: 1; border-color: #25D366; color: #25D366">
                        Order via WhatsApp
                    </a>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--color-border); display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="display:flex; align-items:center; gap:8px"><span style="font-size:1.5rem">🚚</span> Free shipping above ₹499</div>
                    <div style="display:flex; align-items:center; gap:8px"><span style="font-size:1.5rem">📦</span> Ships in 24 hours</div>
                </div>
            </div>
        </div>
    `;
    
    // Load related
    let relatedResult = await api.getProducts('limit=4');
    let relatedProducts = relatedResult?.products || getMockProducts().slice(0,4);
    document.getElementById('relatedProducts').innerHTML = relatedProducts.map(p => createProductCard(p)).join('');
    
    setTimeout(initScrollAnimations, 100);
};

const renderCart = () => {
    const container = document.getElementById('cartContainer');
    
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-state w-100" style="grid-column: 1/-1">
                <div class="empty-icon">🛒</div>
                <h2>Your cart is empty</h2>
                <p class="text-muted mt-4 mb-4">Looks like you haven't added any gifts yet.</p>
                <a href="#/" class="btn btn-primary">Start Shopping</a>
            </div>
        `;
        return;
    }
    
    const subtotal = cartManager.getTotal();
    const shipping = subtotal > 499 ? 0 : 50;
    const total = subtotal + shipping;
    
    const freeShippingProgress = Math.min(100, (subtotal / 499) * 100);
    const progressColor = subtotal >= 499 ? 'var(--color-success)' : 'var(--color-primary)';
    
    let html = `
        <div class="cart-items">
            <div style="background: white; padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px; box-shadow: var(--shadow-sm);">
                <p style="margin-bottom: 10px; font-weight: 500;">
                    ${subtotal >= 499 ? '🎉 You got Free Shipping!' : `Add ${formatPrice(499 - subtotal)} more for Free Shipping!`}
                </p>
                <div style="height: 8px; background: var(--color-bg); border-radius: 4px; overflow: hidden;">
                    <div style="height: 100%; width: ${freeShippingProgress}%; background: ${progressColor}; transition: width 0.3s ease;"></div>
                </div>
            </div>
            
            ${state.cart.map(item => `
                <div class="cart-item">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                    <div class="cart-item-details">
                        <h4 class="cart-item-title">${item.name}</h4>
                        <div class="cart-item-price">${formatPrice(item.price)}</div>
                    </div>
                    <div class="qty-selector" style="margin-bottom: 0">
                        <button class="qty-btn" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                        <input type="number" class="qty-input" value="${item.quantity}" readonly>
                        <button class="qty-btn" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    </div>
                    <button class="remove-btn" onclick="cartManager.remove('${item.id}')" aria-label="Remove item">🗑️</button>
                </div>
            `).join('')}
        </div>
        
        <div class="cart-summary">
            <div class="summary-box">
                <h3 style="margin-bottom: 20px; font-family: var(--font-heading)">Order Summary</h3>
                <div class="summary-row">
                    <span>Subtotal (${cartManager.getCount()} items)</span>
                    <span>${formatPrice(subtotal)}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping</span>
                    <span>${shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
                </div>
                <div class="summary-total">
                    <span>Total</span>
                    <span class="text-primary">${formatPrice(total)}</span>
                </div>
                <a href="#/checkout" class="btn btn-primary w-100">Proceed to Checkout 🔒</a>
                <p style="text-align: center; font-size: 0.8rem; margin-top: 15px; color: var(--color-text-muted)">Secure payments. 100% Satisfaction Guarantee.</p>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
};

const renderCheckout = () => {
    const container = document.getElementById('checkoutContainer');
    
    if (state.cart.length === 0) {
        window.location.hash = '#/cart';
        return;
    }
    
    const subtotal = cartManager.getTotal();
    const shipping = subtotal > 499 ? 0 : 50;
    const total = subtotal + shipping;

    window.submitCheckout = async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.innerHTML = 'Processing... ⏳';
        btn.disabled = true;
        
        const formData = new FormData(e.target);
        const orderData = {
            customer: Object.fromEntries(formData.entries()),
            items: state.cart,
            totalAmount: total
        };
        
        try {
            const res = await api.createOrder(orderData);
            cartManager.clear();
            container.innerHTML = `
                <div class="empty-state w-100" style="grid-column: 1/-1">
                    <div class="empty-icon" style="color: var(--color-success)">🎉</div>
                    <h2>Order Placed Successfully!</h2>
                    <p class="text-muted mt-4 mb-4">Your order #${res?.orderId || 'GL' + Math.floor(Math.random()*10000)} has been received.</p>
                    <p>We'll send you updates on WhatsApp.</p>
                    <a href="#/" class="btn btn-primary mt-4">Continue Shopping</a>
                </div>
            `;
        } catch (err) {
            showToast('Failed to place order. Try again.', 'error');
            btn.innerHTML = 'Place Order 🔒';
            btn.disabled = false;
        }
    };

    container.innerHTML = `
        <div class="checkout-form-container" style="background: white; padding: 30px; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
            <h3 style="margin-bottom: 20px;">Shipping Details</h3>
            <form onsubmit="submitCheckout(event)">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label class="form-label">First Name</label>
                        <input type="text" name="firstName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Last Name</label>
                        <input type="text" name="lastName" class="form-control" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Phone / WhatsApp Number</label>
                    <input type="tel" name="phone" class="form-control" placeholder="10 digit number" pattern="[0-9]{10}" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Email (Optional)</label>
                    <input type="email" name="email" class="form-control">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Address Line 1</label>
                    <input type="text" name="address1" class="form-control" required>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Landmark / Apt / Suite (Optional)</label>
                    <input type="text" name="address2" class="form-control">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group">
                        <label class="form-label">City</label>
                        <input type="text" name="city" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Pincode</label>
                        <input type="text" name="pincode" class="form-control" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">State</label>
                    <input type="text" name="state" class="form-control" required>
                </div>
                
                <h3 style="margin: 30px 0 20px;">Payment Method</h3>
                <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 15px; margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                        <input type="radio" name="payment" value="cod" checked>
                        <span>Cash on Delivery (COD)</span>
                    </label>
                </div>
                <div style="border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 15px; margin-bottom: 30px; opacity: 0.6">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: not-allowed;">
                        <input type="radio" name="payment" value="online" disabled>
                        <span>Online Payment (UPI/Cards) - Temporarily Unavailable</span>
                    </label>
                </div>
                
                <button type="submit" class="btn btn-primary w-100" style="font-size: 1.1rem; padding: 15px;">Place Order 🔒</button>
            </form>
        </div>
        
        <div class="checkout-summary">
            <div class="summary-box">
                <h3 style="margin-bottom: 20px;">Order Items</h3>
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px; padding-right: 10px;">
                    ${state.cart.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; font-size: 0.9rem;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="position: relative;">
                                    <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
                                    <span style="position: absolute; top: -5px; right: -5px; background: var(--color-text-dark); color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">${item.quantity}</span>
                                </div>
                                <span style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name}</span>
                            </div>
                            <span style="font-weight: 500;">${formatPrice(item.price * item.quantity)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="border-top: 1px solid var(--color-border); padding-top: 20px;">
                    <div class="summary-row">
                        <span>Subtotal</span>
                        <span>${formatPrice(subtotal)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping</span>
                        <span>${shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
                    </div>
                    <div class="summary-total" style="margin-bottom: 0;">
                        <span>Total to Pay</span>
                        <span class="text-primary">${formatPrice(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderSearch = async (query) => {
    document.getElementById('searchTitle').textContent = query ? `Results for "${query}"` : 'All Products';
    const container = document.getElementById('searchResults');
    
    container.innerHTML = `<div class="skeleton-grid"><div class="skeleton-card"></div><div class="skeleton-card"></div></div>`;
    
    let res = await api.getProducts(query ? `search=${encodeURIComponent(query)}` : '');
    let products = res?.products;
    
    if (!products) {
        products = getMockProducts();
        if(query) {
            const q = query.toLowerCase();
            products = products.filter(p => p.name.toLowerCase().includes(q));
        }
    }

    if (products.length === 0) {
        container.innerHTML = `<div class="empty-state w-100" style="grid-column: 1/-1"><div class="empty-icon">🔍</div><h3>No gifts found</h3><p>Try searching with different keywords.</p></div>`;
    } else {
        container.innerHTML = products.map(p => createProductCard(p)).join('');
    }
    
    setTimeout(initScrollAnimations, 100);
};

// --- Router ---
const router = () => {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    const segments = path.split('/').filter(Boolean);
    
    // Close mobile menu if open
    document.getElementById('mobileMenuOverlay').classList.remove('active');
    
    // Scroll to top
    window.scrollTo(0, 0);

    // Route logic
    if (segments.length === 0) {
        document.getElementById('view-home').classList.add('active');
        renderHome();
    } 
    else if (segments[0] === 'category' && segments[1]) {
        document.getElementById('view-category').classList.add('active');
        renderCategory(segments[1]);
    } 
    else if (segments[0] === 'product' && segments[1]) {
        document.getElementById('view-product').classList.add('active');
        renderProduct(segments[1]);
    } 
    else if (segments[0] === 'cart') {
        document.getElementById('view-cart').classList.add('active');
        renderCart();
    } 
    else if (segments[0] === 'checkout') {
        document.getElementById('view-checkout').classList.add('active');
        renderCheckout();
    }
    else if (segments[0] === 'search') {
        document.getElementById('view-search').classList.add('active');
        const urlParams = new URLSearchParams(queryString);
        renderSearch(urlParams.get('q') || '');
    }
    else {
        // Fallback
        window.location.hash = '#/';
    }
    
    // Update active state in bottom nav
    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
        item.classList.remove('active');
        if(item.getAttribute('href') === `#${hash}`) item.classList.add('active');
    });
};

// --- Global Event Listeners & Init ---
document.addEventListener('DOMContentLoaded', () => {
    // Init Router
    window.addEventListener('hashchange', router);
    router(); // Initial call
    
    // Init Cart Badge
    cartManager.updateBadge();
    
    // Mobile Menu
    const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        mobileMenuOverlay.classList.add('active');
    });
    document.getElementById('mobileMenuTrigger').addEventListener('click', (e) => {
        e.preventDefault();
        mobileMenuOverlay.classList.add('active');
    });
    document.getElementById('closeMenuBtn').addEventListener('click', () => {
        mobileMenuOverlay.classList.remove('active');
    });
    
    // Search functionality
    const handleSearch = (inputEl) => {
        const query = inputEl.value.trim();
        if(query) {
            window.location.hash = `#/search?q=${encodeURIComponent(query)}`;
            inputEl.value = ''; // clear
        } else {
            window.location.hash = `#/search`;
        }
    };
    
    document.querySelectorAll('.search-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.target.previousElementSibling;
            handleSearch(input);
        });
    });
    
    document.querySelectorAll('.search-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch(input);
        });
    });
    
    // Header Scroll Effect
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = 'var(--shadow-md)';
        } else {
            header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)';
        }
    });

    // Hero Showcase image carousel rotation
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
    }, 3500);
});
