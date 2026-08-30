const API_BASE = '/api';
const UPLOADS_BASE = '/uploads';

// Utility Functions
const utils = {
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
    },
    formatDate: (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },
    debounce: (fn, delay) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    },
    showSpinner: () => document.getElementById('global-spinner').classList.remove('hidden'),
    hideSpinner: () => document.getElementById('global-spinner').classList.add('hidden'),
    
    showToast: (message, type = 'info') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    confirmDialog: (message) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const msgEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');

            msgEl.textContent = message;
            modal.classList.remove('hidden');

            const cleanup = () => {
                modal.classList.add('hidden');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
            };

            const onOk = () => { cleanup(); resolve(true); };
            const onCancel = () => { cleanup(); resolve(false); };

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
        });
    }
};

// Auth Manager
const auth = {
    getToken: () => localStorage.getItem('adminToken'),
    setToken: (token) => localStorage.setItem('adminToken', token),
    isAuthenticated: () => !!localStorage.getItem('adminToken'),
    logout: () => {
        localStorage.removeItem('adminToken');
        app.showView('login');
    },
    fetch: async (url, options = {}) => {
        const token = auth.getToken();
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        
        try {
            const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
            if (res.status === 401 || res.status === 403) {
                auth.logout();
                throw new Error('Unauthorized');
            }
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'API Error');
            }
            const json = await res.json();
            return json.data !== undefined ? json.data : json;
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }
};

// App Manager
const app = {
    currentView: null,
    categoriesList: [],
    uploadedImages: [], // temp array for product form
    
    init: () => {
        app.setupEventListeners();
        
        if (auth.isAuthenticated()) {
            app.navigate('dashboard');
        } else {
            app.showView('login');
        }
    },

    setupEventListeners: () => {
        // Login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;
            try {
                utils.showSpinner();
                const res = await fetch(`${API_BASE}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });
                if(!res.ok) throw new Error('Invalid credentials');
                const data = await res.json();
                const token = data.data && data.data.token ? data.data.token : data.token;
                if (!token) throw new Error('Invalid token returned');
                auth.setToken(token);
                app.navigate('dashboard');
                utils.showToast('Login successful', 'success');
            } catch (err) {
                utils.showToast(err.message, 'error');
            } finally {
                utils.hideSpinner();
            }
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });

        // Sidebar Navigation
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const view = el.getAttribute('data-view');
                if (view) app.navigate(view);
                document.getElementById('sidebar').classList.remove('open');
            });
        });

        // Mobile Sidebar
        document.getElementById('menu-btn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('open');
        });
        document.getElementById('close-sidebar-btn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });

        // Product search & filter
        document.getElementById('product-search').addEventListener('input', utils.debounce(() => {
            app.loadProducts();
        }, 500));
        document.getElementById('product-category-filter').addEventListener('change', () => {
            app.loadProducts();
        });

        // Product Form Submit
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await app.saveProduct();
        });

        // Category search
        document.getElementById('category-search').addEventListener('input', utils.debounce(() => {
            app.loadCategories();
        }, 500));

        // Category Modal
        document.getElementById('add-category-btn').addEventListener('click', () => {
            document.getElementById('category-id').value = '';
            document.getElementById('category-form').reset();
            document.getElementById('category-image-preview').style.backgroundImage = 'none';
            document.getElementById('category-modal-title').textContent = 'Add Category';
            document.getElementById('category-modal').classList.remove('hidden');
        });
        document.getElementById('category-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await app.saveCategory();
        });

        // Orders Tab
        document.querySelectorAll('#order-tabs .tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('#order-tabs .tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                app.loadOrders();
            });
        });
        document.getElementById('order-search').addEventListener('input', utils.debounce(() => {
            app.loadOrders();
        }, 500));

        // Settings Form
        document.getElementById('settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await app.saveSettings();
        });

        app.setupImageUpload();
    },

    setupImageUpload: () => {
        const zone = document.getElementById('image-upload-zone');
        const input = document.getElementById('image-upload-input');

        zone.addEventListener('click', () => input.click());

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                app.uploadImages(e.dataTransfer.files);
            }
        });

        input.addEventListener('change', (e) => {
            if (e.target.files.length) {
                app.uploadImages(e.target.files);
            }
        });
    },

    uploadImages: async (files) => {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
        
        try {
            utils.showSpinner();
            const res = await auth.fetch('/upload', {
                method: 'POST',
                body: formData
            });
            const filenames = Array.isArray(res) ? res.map(url => url.split('/').pop()) : [];
            app.uploadedImages = [...app.uploadedImages, ...filenames];
            app.renderImagePreviews();
        } catch (err) {
            utils.showToast('Image upload failed', 'error');
        } finally {
            utils.hideSpinner();
            document.getElementById('image-upload-input').value = '';
        }
    },

    renderImagePreviews: () => {
        const grid = document.getElementById('image-preview-grid');
        grid.innerHTML = '';
        app.uploadedImages.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'image-preview-item';
            div.innerHTML = `
                <img src="${UPLOADS_BASE}/${img}" alt="preview">
                <button type="button" class="remove-btn" onclick="app.removeImage(${index})">✕</button>
            `;
            grid.appendChild(div);
        });
    },

    removeImage: (index) => {
        app.uploadedImages.splice(index, 1);
        app.renderImagePreviews();
    },

    showView: (viewId) => {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('app-view').classList.add('hidden');
        
        document.querySelectorAll('.page-view').forEach(v => v.classList.add('hidden'));

        if (viewId === 'login') {
            document.getElementById('login-view').classList.remove('hidden');
        } else {
            document.getElementById('app-view').classList.remove('hidden');
            const pageView = document.getElementById(`${viewId}-view`);
            if(pageView) pageView.classList.remove('hidden');
        }
    },

    navigate: (view, params = null) => {
        if (!auth.isAuthenticated()) return auth.logout();
        
        app.currentView = view;
        
        // Update sidebar
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
            el.classList.remove('active');
            if (el.getAttribute('data-view') === view || (view==='product-form' && el.getAttribute('data-view')==='products')) {
                el.classList.add('active');
            }
        });

        // Set title
        const titles = {
            'dashboard': 'Dashboard',
            'products': 'Products',
            'product-form': 'Manage Product',
            'categories': 'Categories',
            'orders': 'Orders',
            'settings': 'Settings'
        };
        document.getElementById('page-title').textContent = titles[view] || 'Admin';

        app.showView(view);

        // Load data based on view
        if (view === 'dashboard') app.loadDashboard();
        if (view === 'products') app.loadProducts();
        if (view === 'product-form') app.loadProductForm(params);
        if (view === 'categories') app.loadCategories();
        if (view === 'orders') app.loadOrders();
        if (view === 'settings') app.loadSettings();

        // Load categories list globally if empty
        if ((view === 'products' || view === 'product-form') && app.categoriesList.length === 0) {
            app.fetchCategoriesList();
        }
    },

    // --- Dashboard ---
    loadDashboard: async () => {
        try {
            utils.showSpinner();
            const data = await auth.fetch('/dashboard/stats');
            
            // Stats
            document.getElementById('dashboard-stats').innerHTML = `
                <div class="stat-card">
                    <div class="stat-icon bg-blue-100">📦</div>
                    <div class="stat-info">
                        <h4>Total Products</h4>
                        <div class="stat-value">${data.total_products || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-yellow-100">📁</div>
                    <div class="stat-info">
                        <h4>Categories</h4>
                        <div class="stat-value">${data.total_categories || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-green-100">🛒</div>
                    <div class="stat-info">
                        <h4>Total Orders</h4>
                        <div class="stat-value">${data.total_orders || 0}</div>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-purple-100">₹</div>
                    <div class="stat-info">
                        <h4>Revenue</h4>
                        <div class="stat-value">${utils.formatCurrency(data.total_revenue || 0)}</div>
                    </div>
                </div>
            `;

            // Recent Orders
            const tbody = document.getElementById('recent-orders-body');
            tbody.innerHTML = '';
            if (data.recent_orders && data.recent_orders.length) {
                data.recent_orders.forEach(o => {
                    tbody.innerHTML += `
                        <tr>
                            <td>#${o.order_number || o.id}</td>
                            <td>${o.customer_name}</td>
                            <td>${o.phone || '-'}</td>
                            <td>${utils.formatCurrency(o.total)}</td>
                            <td><span class="badge-status badge-${o.order_status.toLowerCase()}">${o.order_status}</span></td>
                            <td>${utils.formatDate(o.created_at)}</td>
                        </tr>
                    `;
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No recent orders</td></tr>';
            }
        } catch (err) {
            utils.showToast('Failed to load dashboard', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    // --- Products ---
    fetchCategoriesList: async () => {
        try {
            const data = await auth.fetch('/categories');
            app.categoriesList = Array.isArray(data) ? data : data.categories || [];
            
            // Populate filter
            const filter = document.getElementById('product-category-filter');
            filter.innerHTML = '<option value="">All Categories</option>';
            
            // Populate form select
            const formSelect = document.getElementById('product-category');
            formSelect.innerHTML = '<option value="">Select Category</option>';

            app.categoriesList.forEach(c => {
                const opt = `<option value="${c.id}">${c.name}</option>`;
                filter.innerHTML += opt;
                formSelect.innerHTML += opt;
            });
        } catch (err) {
            console.error('Failed to fetch categories list');
        }
    },

    loadProducts: async () => {
        try {
            const search = document.getElementById('product-search').value;
            const category = document.getElementById('product-category-filter').value;
            const query = new URLSearchParams({ search, category, limit: 20 }).toString();

            utils.showSpinner();
            const data = await auth.fetch(`/products?${query}`);
            const products = data.products || data || [];

            const tbody = document.getElementById('products-body');
            tbody.innerHTML = '';

            if (products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No products found</td></tr>';
                return;
            }

            products.forEach(p => {
                const imgUrl = p.images && p.images[0] ? `${UPLOADS_BASE}/${p.images[0]}` : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                const catName = app.categoriesList.find(c => c.id == p.category_id)?.name || p.category_name || '-';
                const statusBadge = p.is_active ? '<span class="badge-status badge-active">Active</span>' : '<span class="badge-status badge-inactive">Inactive</span>';

                tbody.innerHTML += `
                    <tr>
                        <td><input type="checkbox" value="${p.id}"></td>
                        <td><img src="${imgUrl}" class="thumbnail" alt=""></td>
                        <td>${p.name}</td>
                        <td>${catName}</td>
                        <td>${utils.formatCurrency(p.price)}</td>
                        <td>${p.stock}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="app.navigate('product-form', ${p.id})">Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteProduct(${p.id})">Del</button>
                        </td>
                    </tr>
                `;
            });
        } catch (err) {
            utils.showToast('Failed to load products', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    deleteProduct: async (id) => {
        const confirmed = await utils.confirmDialog('Are you sure you want to delete this product?');
        if (!confirmed) return;

        try {
            utils.showSpinner();
            await auth.fetch(`/products/${id}`, { method: 'DELETE' });
            utils.showToast('Product deleted', 'success');
            app.loadProducts();
        } catch (err) {
            utils.showToast('Failed to delete product', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    // --- Product Form ---
    loadProductForm: async (id) => {
        const form = document.getElementById('product-form');
        form.reset();
        app.uploadedImages = [];
        app.renderImagePreviews();
        document.getElementById('product-id').value = '';

        if (id) {
            document.getElementById('product-form-title').textContent = 'Edit Product';
            try {
                utils.showSpinner();
                const p = await auth.fetch(`/products/${id}`);
                
                document.getElementById('product-id').value = p.id;
                document.getElementById('product-name').value = p.name || '';
                document.getElementById('product-category').value = p.category_id || p.category_name || '';
                document.getElementById('product-description').value = p.description || '';
                document.getElementById('product-price').value = p.price || '';
                document.getElementById('product-compare-price').value = p.compare_price || '';
                document.getElementById('product-stock').value = p.stock || 0;
                document.getElementById('product-badge').value = p.badge || '';
                document.getElementById('product-featured').checked = p.is_featured || false;
                document.getElementById('product-active').checked = p.is_active !== false;

                if (p.images && Array.isArray(p.images)) {
                    app.uploadedImages = [...p.images];
                    app.renderImagePreviews();
                }

            } catch (err) {
                utils.showToast('Failed to load product details', 'error');
                app.navigate('products');
            } finally {
                utils.hideSpinner();
            }
        } else {
            document.getElementById('product-form-title').textContent = 'Add Product';
            document.getElementById('product-active').checked = true;
        }
    },

    saveProduct: async () => {
        const id = document.getElementById('product-id').value;
        const payload = {
            name: document.getElementById('product-name').value,
            category_id: document.getElementById('product-category').value,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            compare_price: parseFloat(document.getElementById('product-compare-price').value) || null,
            stock: parseInt(document.getElementById('product-stock').value, 10),
            badge: document.getElementById('product-badge').value,
            is_featured: document.getElementById('product-featured').checked,
            is_active: document.getElementById('product-active').checked,
            images: app.uploadedImages
        };

        try {
            utils.showSpinner();
            if (id) {
                await auth.fetch(`/products/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                utils.showToast('Product updated successfully', 'success');
            } else {
                await auth.fetch('/products', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                utils.showToast('Product created successfully', 'success');
            }
            app.navigate('products');
        } catch (err) {
            utils.showToast('Failed to save product', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    // --- Categories ---
    loadCategories: async () => {
        try {
            const search = document.getElementById('category-search').value;
            utils.showSpinner();
            const data = await auth.fetch(`/categories?search=${search}`);
            const categories = data.categories || data || [];

            const grid = document.getElementById('categories-grid');
            grid.innerHTML = '';

            if (categories.length === 0) {
                grid.innerHTML = '<div class="empty-state">No categories found</div>';
                return;
            }

            categories.forEach(c => {
                const imgUrl = c.image ? `${UPLOADS_BASE}/${c.image}` : 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                grid.innerHTML += `
                    <div class="category-card">
                        <img src="${imgUrl}" alt="">
                        <h4>${c.name}</h4>
                        <p class="text-muted" style="font-size:0.8rem">${c.product_count || 0} products</p>
                        <div class="category-actions">
                            <button class="btn btn-sm btn-outline" onclick='app.editCategory(${JSON.stringify(c)})'>Edit</button>
                            <button class="btn btn-sm btn-danger" onclick="app.deleteCategory(${c.id})">Delete</button>
                        </div>
                    </div>
                `;
            });
            // Update global list
            app.categoriesList = categories;
        } catch (err) {
            utils.showToast('Failed to load categories', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    closeCategoryModal: () => {
        document.getElementById('category-modal').classList.add('hidden');
    },

    editCategory: (c) => {
        document.getElementById('category-id').value = c.id;
        document.getElementById('category-name').value = c.name;
        document.getElementById('category-description').value = c.description || '';
        
        const preview = document.getElementById('category-image-preview');
        if (c.image) {
            preview.style.backgroundImage = `url(${UPLOADS_BASE}/${c.image})`;
        } else {
            preview.style.backgroundImage = 'none';
        }
        
        document.getElementById('category-modal-title').textContent = 'Edit Category';
        document.getElementById('category-modal').classList.remove('hidden');
    },

    saveCategory: async () => {
        const id = document.getElementById('category-id').value;
        const name = document.getElementById('category-name').value;
        const desc = document.getElementById('category-description').value;
        const fileInput = document.getElementById('category-image-input');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', desc);
        if (fileInput.files[0]) {
            formData.append('image', fileInput.files[0]);
        }

        try {
            utils.showSpinner();
            if (id) {
                await auth.fetch(`/categories/${id}`, { method: 'PUT', body: formData });
                utils.showToast('Category updated', 'success');
            } else {
                await auth.fetch('/categories', { method: 'POST', body: formData });
                utils.showToast('Category added', 'success');
            }
            app.closeCategoryModal();
            app.loadCategories();
            app.fetchCategoriesList(); // Refresh list
        } catch (err) {
            utils.showToast('Failed to save category', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    deleteCategory: async (id) => {
        const confirmed = await utils.confirmDialog('Delete this category? This might affect products.');
        if (!confirmed) return;

        try {
            utils.showSpinner();
            await auth.fetch(`/categories/${id}`, { method: 'DELETE' });
            utils.showToast('Category deleted', 'success');
            app.loadCategories();
        } catch (err) {
            utils.showToast('Failed to delete category', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    // --- Orders ---
    loadOrders: async () => {
        try {
            const search = document.getElementById('order-search').value;
            const status = document.querySelector('#order-tabs .active').getAttribute('data-status');
            const query = new URLSearchParams({ search, status }).toString();

            utils.showSpinner();
            const data = await auth.fetch(`/orders?${query}`);
            const orders = data.orders || data || [];

            const tbody = document.getElementById('orders-body');
            tbody.innerHTML = '';

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No orders found</td></tr>';
                return;
            }

            orders.forEach(o => {
                tbody.innerHTML += `
                    <tr>
                        <td>#${o.order_number || o.id}</td>
                        <td>${o.customer_name}</td>
                        <td>${o.phone || '-'}</td>
                        <td>${JSON.parse(o.items || '[]').length}</td>
                        <td>${utils.formatCurrency(o.total)}</td>
                        <td>
                            <select onchange="app.updateOrderStatus(${o.id}, this.value)" class="badge-status badge-${o.order_status.toLowerCase()}">
                                <option value="Pending" ${o.order_status==='Pending'?'selected':''}>Pending</option>
                                <option value="Confirmed" ${o.order_status==='Confirmed'?'selected':''}>Confirmed</option>
                                <option value="Shipped" ${o.order_status==='Shipped'?'selected':''}>Shipped</option>
                                <option value="Delivered" ${o.order_status==='Delivered'?'selected':''}>Delivered</option>
                                <option value="Cancelled" ${o.order_status==='Cancelled'?'selected':''}>Cancelled</option>
                            </select>
                        </td>
                        <td>${utils.formatDate(o.created_at)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline" onclick="app.viewOrder(${o.id})">View</button>
                        </td>
                    </tr>
                `;
            });
        } catch (err) {
            utils.showToast('Failed to load orders', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    updateOrderStatus: async (id, status) => {
        try {
            utils.showSpinner();
            await auth.fetch(`/orders/${id}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
            utils.showToast('Order status updated', 'success');
            // Refresh colors on the select element handled by re-rendering or class toggling, simplest is reload:
            app.loadOrders();
        } catch (err) {
            utils.showToast('Failed to update status', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    viewOrder: async (id) => {
        try {
            utils.showSpinner();
            const o = await auth.fetch(`/orders/${id}`);
            
            let items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
            let itemsHtml = items.map(i => `
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
                    <div>${i.name} x ${i.quantity}</div>
                    <div>${utils.formatCurrency(i.price * i.quantity)}</div>
                </div>
            `).join('');

            const html = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <h4>Customer Details</h4>
                        <p>${o.customer_name}<br>${o.email || ''}<br>${o.phone || ''}</p>
                    </div>
                    <div>
                        <h4>Shipping Address</h4>
                        <p>${o.address || 'N/A'}</p>
                    </div>
                </div>
                <div>
                    <h4>Order Items</h4>
                    <div style="margin-top:1rem; border:1px solid #eee; padding:1rem; border-radius:4px;">
                        ${itemsHtml}
                        <div style="display:flex; justify-content:space-between; margin-top:1rem; font-weight:bold;">
                            <div>Total Amount</div>
                            <div>${utils.formatCurrency(o.total)}</div>
                        </div>
                    </div>
                </div>
                <div style="margin-top: 1rem;">
                    <h4>Payment Info</h4>
                    <p>Method: ${o.payment_id || 'N/A'} | Status: ${o.payment_status || 'N/A'}</p>
                </div>
            `;

            document.getElementById('order-detail-title').textContent = `Order #${o.order_number || o.id}`;
            document.getElementById('order-detail-body').innerHTML = html;
            document.getElementById('order-detail-modal').classList.remove('hidden');

        } catch (err) {
            utils.showToast('Failed to load order details', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    closeOrderModal: () => {
        document.getElementById('order-detail-modal').classList.add('hidden');
    },

    // --- Settings ---
    loadSettings: async () => {
        try {
            utils.showSpinner();
            const s = await auth.fetch('/settings');
            
            document.getElementById('setting-shop-name').value = s.shopName || '';
            document.getElementById('setting-announcement').value = s.announcement || '';
            document.getElementById('setting-whatsapp').value = s.whatsapp || '';
            document.getElementById('setting-phone').value = s.phone || '';
            document.getElementById('setting-email').value = s.email || '';
            document.getElementById('setting-address').value = s.address || '';
            document.getElementById('setting-free-shipping').value = s.freeShippingThreshold || '';
            document.getElementById('setting-min-order').value = s.minOrderAmount || '';
            
        } catch (err) {
            utils.showToast('Failed to load settings', 'error');
        } finally {
            utils.hideSpinner();
        }
    },

    saveSettings: async () => {
        const payload = {
            shopName: document.getElementById('setting-shop-name').value,
            announcement: document.getElementById('setting-announcement').value,
            whatsapp: document.getElementById('setting-whatsapp').value,
            phone: document.getElementById('setting-phone').value,
            email: document.getElementById('setting-email').value,
            address: document.getElementById('setting-address').value,
            freeShippingThreshold: parseFloat(document.getElementById('setting-free-shipping').value) || 0,
            minOrderAmount: parseFloat(document.getElementById('setting-min-order').value) || 0
        };

        try {
            utils.showSpinner();
            await auth.fetch('/settings', {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            utils.showToast('Settings saved successfully', 'success');
        } catch (err) {
            utils.showToast('Failed to save settings', 'error');
        } finally {
            utils.hideSpinner();
        }
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', app.init);
