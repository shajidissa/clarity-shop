/* ===================== CONFIG ===================== */
// If developing with `netlify dev`, keep this relative:
const NETLIFY_FUNCTION_URL =
    'https://clarity-shop.netlify.app/.netlify/functions/create-checkout';

// Your Stripe PUBLISHABLE key (test now, live later)
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SU8YDAGUzM7chQmp0Fm1ytVRWShLxBbjivs06CO9vatcMkKx2MHv1imGCM4RDeMFm4Nn4mabIR4X2Oc71xq9r0P00jpZECTr0';

/* ===================== STATE ===================== */
let cart = JSON.parse(localStorage.getItem('clarityCart')) || [];
let allProducts = [];

/* ===================== HELPERS ===================== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function saveCart() {
    localStorage.setItem('clarityCart', JSON.stringify(cart));
    updateCartUI();
}
function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    $$('#cart-count').forEach(el => {
        el.textContent = count;
        const link = el.closest('.cart-link');
        if (link && !link.classList.contains('pulse-active')) {
            link.classList.add('pulse', 'pulse-active');
            setTimeout(() => link.classList.remove('pulse', 'pulse-active'), 450);
        }
    });
}
function toast(message, isError = false) {
    const t = $('#toast'); if (!t) return;
    t.textContent = message;
    t.style.backgroundColor = isError ? '#d9534f' : '#111';
    t.hidden = false; t.classList.add('show');
    const live = $('#live'); if (live) live.textContent = message;
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 300); }, 2000);
}

/* ===================== DATA ===================== */
async function loadProducts() {
    if (allProducts.length) return allProducts;
    const res = await fetch('products.json');
    if (!res.ok) throw new Error(`Failed to fetch products.json (${res.status})`);
    allProducts = await res.json();
    return allProducts;
}

/* ===================== HOME ===================== */
async function renderHome() {
    const container = $('#products'); if (!container) return;
    const prods = await loadProducts();
    container.innerHTML = prods.map(p => `
    <div class="card" data-id="${p.id}">
      <a href="product.html?id=${p.id}">
        <img src="${p.image}" alt="${p.name}"/>
      </a>
      <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <p class="price">£${Number(p.price).toFixed(2)}</p>
      <p class="stock">${p.stock > 0 ? `Only ${p.stock} left!` : 'Out of Stock'}</p>

      <label for="size-${p.id}" class="visually-hidden">Size</label>
      <select id="size-${p.id}" class="size" ${!p.sizes?.length ? 'hidden' : ''}>
        ${(p.sizes || []).map(s => `<option>${s}</option>`).join('')}
      </select>

      <label for="color-${p.id}" class="visually-hidden">Color</label>
      <select id="color-${p.id}" class="color" ${!p.colors?.length ? 'hidden' : ''}>
        ${(p.colors || []).map(c => `<option>${c}</option>`).join('')}
      </select>

      <button class="add-to-cart" data-id="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>
        ${p.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
      </button>
    </div>
  `).join('');

    $$('.add-to-cart').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.currentTarget.closest('.card');
            const id   = Number(card.dataset.id);
            const size = card.querySelector('.size')?.value || '';
            const color= card.querySelector('.color')?.value || '';
            const p = allProducts.find(x => x.id === id);
            if (p) addToCart(p, size, color, e.currentTarget);
        };
    });
}

/* ===================== PRODUCT PAGE ===================== */
// FULL REPLACEMENT
// FULL REPLACEMENT
async function renderProduct() {
    const mount = document.getElementById('product-detail') || document.querySelector('.product-detail');
    if (!mount) return; // not on product page

    const id = parseInt(new URLSearchParams(location.search).get('id'), 10);
    const products = await loadProducts();
    const p = products.find(x => x.id === id);
    if (!p) { location.href = 'index.html'; return; }

    // Breadcrumb + title
    const crumb = document.getElementById('crumb-name');
    if (crumb) crumb.textContent = p.name;
    document.title = `${p.name} – Clarity Hoodies`;

    // Use images[] if present; else fallback to single image
    const images = (Array.isArray(p.images) && p.images.length) ? p.images : [p.image];
    const sizes  = Array.isArray(p.sizes)  ? p.sizes  : [];
    const colors = Array.isArray(p.colors) ? p.colors : [];

    // Build gallery + info INSIDE the product container only
    mount.innerHTML = `
    <div class="pd-wrap">
      <div class="pd-gallery">
        <div class="pd-thumbs" id="pdThumbs">
          ${images.map((src, i) => `
            <button class="pd-thumb ${i === 0 ? 'is-active' : ''}" type="button" data-src="${src}">
              <img src="${src}" alt="${p.name} ${i + 1}">
            </button>
          `).join('')}
        </div>
        <figure class="pd-figure">
          <img id="pdMain" src="${images[0]}" alt="${p.name}">
        </figure>
      </div>

      <aside class="info pd-info">
        <h1>${p.name}</h1>
        <p class="price">£${Number(p.price).toFixed(2)}</p>
        <p class="stock">${p.stock > 0 ? `Only ${p.stock} left!` : 'Out of Stock'}</p>

        ${sizes.length ? `
          <label for="size">Size</label>
          <select id="size">${sizes.map(s => `<option>${s}</option>`).join('')}</select>
        ` : ''}

        ${colors.length ? `
          <label for="color">Color</label>
          <select id="color">${colors.map(c => `<option>${c}</option>`).join('')}</select>
        ` : ''}

        <button id="add-to-cart-product" ${p.stock === 0 ? 'disabled' : ''}>
          ${p.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </aside>
    </div>
  `;

    // Click-to-swap thumbnails
    const main = mount.querySelector('#pdMain');
    mount.querySelectorAll('.pd-thumb').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-src');
            if (src) main.src = src;
            mount.querySelectorAll('.pd-thumb').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
    });

    // Keep your existing addToCart flow
    const addBtn = document.getElementById('add-to-cart-product');
    if (addBtn) {
        addBtn.onclick = (e) => {
            const size  = document.getElementById('size')?.value || '';
            const color = document.getElementById('color')?.value || '';
            try { addToCart(p, size, color, e.currentTarget); }
            catch { addToCart(p, size, color); }
            toast(`${p.name} added to cart`);
        };
    }
}

/* ===================== CART LOGIC ===================== */
function addToCart(prod, size, color, btn) {
    const cartId = `${prod.id}-${size}-${color}`;
    const existing = cart.find(i => i.cartId === cartId);

    if (existing) {
        if ((existing.quantity || 1) < prod.stock) {
            existing.quantity = (existing.quantity || 1) + 1;
            toast(`${prod.name} quantity updated`);
        } else {
            toast(`No more stock for ${prod.name}!`, true);
            return;
        }
    } else {
        if (prod.stock === 0) { toast(`${prod.name} is out of stock!`, true); return; }
        cart.push({
            cartId, id: prod.id, name: prod.name,
            price: prod.price,                // display only
            priceInPence: prod.priceInPence,  // display only
            size, color, quantity: 1, image: prod.image, stock: prod.stock
        });
        toast(`Added ${prod.name} to cart`);
    }

    if (btn && !btn.classList.contains('is-added')) {
        const original = btn.innerHTML;
        btn.classList.add('is-added');
        setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = original; }, 1200);
    }

    saveCart();
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.cartId !== cartId);
    saveCart();
    renderCart();
}

/* ===================== CART PAGE RENDER ===================== */
function renderCart() {
    const itemsWrap = $('#cart-items');
    const totalEl   = $('#total');
    const checkoutBtn = $('#checkout-button');
    if (!itemsWrap) return;

    if (!cart.length) {
        itemsWrap.innerHTML = `<p>Your cart is empty.</p>`;
        if (totalEl) totalEl.textContent = '0.00';
        if (checkoutBtn) checkoutBtn.hidden = true;
        return;
    }

    itemsWrap.innerHTML = cart.map(it => `
    <div class="cart-line" data-cart-id="${it.cartId}">
      <div class="cart-line__main">
        <strong>${it.name}</strong>
        <div class="muted">${[it.size, it.color].filter(Boolean).join(' / ')}</div>
      </div>
      <div class="cart-line__qty">×${it.quantity || 1}</div>
      <div class="cart-line__price">£${(Number(it.price) * (it.quantity || 1)).toFixed(2)}</div>
      <button class="cart-line__remove" data-cart-id="${it.cartId}">✕</button>
    </div>
  `).join('');

    $$('.cart-line__remove').forEach(btn => {
        btn.onclick = (e) => removeFromCart(e.currentTarget.dataset.cartId);
    });

    const grand = cart.reduce((s, it) => s + Number(it.price) * (it.quantity || 1), 0);
    if (totalEl) totalEl.textContent = grand.toFixed(2);
    if (checkoutBtn) { checkoutBtn.hidden = false; checkoutBtn.onclick = handleCheckout; }
}

/* ===================== STRIPE CHECKOUT ===================== */
async function handleCheckout() {
    const btn = $('#checkout-button'); if (!btn) return;

    if (typeof Stripe === 'undefined') { toast('Payment error. Please refresh.', true); return; }
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes('REPLACE_ME')) {
        toast('Payment setup incomplete. Admin action required.', true); return;
    }

    btn.disabled = true; btn.textContent = 'Processing…';
    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    try {
        // Send only ids & quantities; server maps to authoritative prices

        // Build items (unchanged)
        const payloadItems = cart.map(it => ({
            id: it.id, quantity: it.quantity || 1, size: it.size, color: it.color
        }));

        // Compute subfolder from current URL, e.g. "/clarity-shop"
        const basePath = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');

        // Send to Netlify function
        const res = await fetch(NETLIFY_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payloadItems, basePath })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `Checkout failed (${res.status})`);
        }
        const data = await res.json();

        const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (error) throw new Error(error.message);
    } catch (err) {
        console.error('Checkout error:', err);
        toast(`Error: ${err.message}`, true);
        btn.disabled = false; btn.textContent = 'Checkout';
    }
}

/* ===================== ROUTER ===================== */
async function router() {
    try {
        await loadProducts();
        const path = location.pathname;
        if (path.endsWith('product.html')) renderProduct();
        else if (path.endsWith('cart.html')) renderCart();
        else if (path.endsWith('/') || path.endsWith('index.html')) renderHome();
        updateCartUI();
    } catch (e) {
        console.error('Init error:', e);
        const body = $('body');
        if (body) body.innerHTML = `<h1>Error</h1><p>Could not load products.</p>`;
    }
}
router();