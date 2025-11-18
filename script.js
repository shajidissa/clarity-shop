/* ===================== CONFIG ===================== */
// If developing with `netlify dev`, keep this relative:
const NETLIFY_FUNCTION_URL =
    'https://clarity-shop.netlify.app/.netlify/functions/create-checkout';

// Your Stripe PUBLISHABLE key
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
    try {
        const res = await fetch('products.json');
        if (!res.ok) throw new Error(`Failed to fetch products.json (${res.status})`);
        allProducts = await res.json();
        return allProducts;
    } catch (e) {
        console.error(e);
        return [];
    }
}

/* ===================== HOME ===================== */
async function renderHome() {
    const container = $('#products'); if (!container) return;
    const prods = await loadProducts();

    container.innerHTML = prods.map(p => {
        const imgSrc = (Array.isArray(p.images) && p.images.length ? p.images[0] : p.image);
        return `
      <div class="card" data-id="${p.id}">
        <a href="product.html?id=${p.id}">
          <img src="${imgSrc}" alt="${p.name}"/>
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
    `;
    }).join('');

    $$('.add-to-cart').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.currentTarget.closest('.card');
            const id   = Number(card.dataset.id);
            const size = card.querySelector('.size')?.value || '';
            const color= card.querySelector('.color')?.value || '';
            const p = allProducts.find(x => x.id === id);
            if (p) addToCart(p, size, color, 1, e.currentTarget);
        };
    });
}

/* ===================== PRODUCT PAGE ===================== */
async function renderProduct() {
    const mount = document.getElementById('product-detail');
    if (!mount) return;

    const id = parseInt(new URLSearchParams(location.search).get('id'), 10);
    const products = await loadProducts();
    const p = products.find(x => Number(x.id) === id);
    if (!p) { location.href = 'index.html'; return; }

    const crumb = document.getElementById('crumb-name');
    if (crumb) crumb.textContent = p.name;
    document.title = `${p.name} – Clarity`;

    const images = (Array.isArray(p.images) && p.images.length) ? p.images : [p.image];
    const sizes  = Array.isArray(p.sizes)  ? p.sizes  : [];
    const colors = Array.isArray(p.colors) ? p.colors : [];
    const pricePence = p.priceInPence ?? Math.round((p.price || 0) * 100);

    // Define max stock (fall back to a high number if unlimited/undefined)
    const maxStock = (typeof p.stock === 'number') ? p.stock : 999;

    mount.innerHTML = `
    <div class="pd-wrap">
      <div class="pd-gallery">
        <div class="pd-thumbs" id="pdThumbs">
          ${images.map((src, i) => `
            <button class="pd-thumb ${i===0 ? 'is-active' : ''}" type="button" data-src="${src}">
              <img src="${src}" alt="${p.name} ${i+1}">
            </button>
          `).join('')}
        </div>
        <figure class="pd-figure">
          <img id="pdMain" src="${images[0]}" alt="${p.name}">
        </figure>
      </div>

      <aside class="info pd-info">
        <h1>${p.name}</h1>
        <p class="price">£${(pricePence/100).toFixed(2)}</p>
        ${typeof p.stock === 'number' ? `<p class="stock">${p.stock > 0 ? `Only ${p.stock} left!` : 'Out of Stock'}</p>` : ''}

        ${sizes.length ? `
          <label for="pdSize">Size</label>
          <select id="pdSize">${sizes.map(s => `<option>${s}</option>`).join('')}</select>
        ` : ''}

        ${colors.length ? `
          <label for="pdColor">Color</label>
          <select id="pdColor">${colors.map(c => `<option>${c}</option>`).join('')}</select>
        ` : ''}

        <div class="pd-actions">
          <label for="pdQty">Quantity</label>
          <div class="qty-control">
            <button type="button" class="qty-btn" data-delta="-1" aria-label="Decrease" disabled>−</button>
            <input id="pdQty" class="qty-input" type="number" min="1" max="${maxStock}" value="1" inputmode="numeric">
            <button type="button" class="qty-btn" data-delta="1" aria-label="Increase" ${maxStock <= 1 ? 'disabled' : ''}>+</button>
          </div>

          <button id="add-to-cart-product" ${p.stock === 0 ? 'disabled' : ''}>
            ${p.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </aside>
    </div>
  `;

    // Thumbs → swap main
    const main = mount.querySelector('#pdMain');
    mount.querySelectorAll('.pd-thumb').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-src');
            if (src) main.src = src;
            mount.querySelectorAll('.pd-thumb').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
    });

    // Quantity Logic (Updated for Stock Limit)
    const qtyEl    = mount.querySelector('#pdQty');
    const minusBtn = mount.querySelector('.qty-btn[data-delta="-1"]');
    const plusBtn  = mount.querySelector('.qty-btn[data-delta="1"]');

    function updateQtyUI(val) {
        // Ensure value is within 1 and Max Stock
        let v = parseInt(val, 10);
        if (isNaN(v)) v = 1;
        v = Math.max(1, Math.min(maxStock, v));

        // Update input
        qtyEl.value = v;

        // Disable buttons if at limits
        if(minusBtn) minusBtn.disabled = (v <= 1);
        if(plusBtn)  plusBtn.disabled  = (v >= maxStock);
    }

    // Attach Listeners
    if(minusBtn) minusBtn.onclick = () => updateQtyUI(parseInt(qtyEl.value || '1') - 1);
    if(plusBtn)  plusBtn.onclick  = () => updateQtyUI(parseInt(qtyEl.value || '1') + 1);

    // Handle manual typing
    if(qtyEl) {
        qtyEl.addEventListener('change', (e) => updateQtyUI(e.target.value));
        qtyEl.addEventListener('input', (e) => {
            // Optional: Real-time clamp if they type a huge number
            const val = parseInt(e.target.value, 10);
            if (val > maxStock) updateQtyUI(maxStock);
        });
    }

    // Add to cart
    const addBtn = mount.querySelector('#add-to-cart-product');
    addBtn?.addEventListener('click', (e) => {
        const qty   = Math.max(1, parseInt(qtyEl.value || '1', 10));
        const size  = mount.querySelector('#pdSize')?.value || '';
        const color = mount.querySelector('#pdColor')?.value || '';

        addToCart({
            id: p.id,
            name: p.name,
            price: p.price,
            priceInPence: pricePence,
            image: images[0],
            size, color,
            stock: p.stock
        }, size, color, qty, e.currentTarget);

        if (typeof toast === 'function') toast(`Added ${qty} × ${p.name}`);
    });
}

/* ===================== CART LOGIC (SHARED) ===================== */
function addToCart(prod, size = '', color = '', maybeQtyOrBtn, maybeBtn) {
    let qty = 1, btn = null;
    if (typeof maybeQtyOrBtn === 'number') {
        qty = Math.max(1, parseInt(maybeQtyOrBtn, 10) || 1);
        btn = maybeBtn || null;
    } else {
        btn = maybeQtyOrBtn || null;
    }

    const pricePence = prod.priceInPence ?? Math.round((prod.price || 0) * 100);
    const img0 = (Array.isArray(prod.images) && prod.images.length ? prod.images[0] : prod.image) || '';

    const cartId = `${prod.id}-${size}-${color}`;
    const existing = cart.find(i => i.cartId === cartId);
    const stock = (typeof prod.stock === 'number') ? prod.stock : Infinity;

    if (existing) {
        const current = existing.quantity || 1;
        const next = current + qty;
        if (next > stock) {
            existing.quantity = stock; // clamp
            toast(`Only ${stock} in stock — set to ${stock}`, true);
        } else {
            existing.quantity = next;
            toast(`${prod.name} quantity updated`);
        }
    } else {
        if (stock < 1) { toast(`${prod.name} is out of stock!`, true); return; }
        const initialQty = Math.min(qty, stock);
        if (qty > stock) toast(`Only ${stock} in stock — added ${stock}`, true);

        cart.push({
            cartId,
            id: prod.id,
            name: prod.name,
            price: prod.price,
            priceInPence: pricePence,
            size, color,
            quantity: initialQty,
            image: img0,
            stock
        });
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
    // If on cart page, re-render specifically
    if (document.getElementById('c-items')) {
        initCartPage(true); // re-render
    } else {
        updateCartUI();
    }
}

/* ===================== CART PAGE RENDERER ===================== */

// Helper to determine stock limit for a cart item based on global products
function maxForItem(it, stockData) {
    if (!stockData) return Infinity;
    const p = stockData.find(x => String(x.id) === String(it.id));
    if (!p) return Infinity;

    // Size specific stock (if your data supported it)
    if (it.size && p.sizes && p.sizes[it.size] && typeof p.sizes[it.size].stock === 'number') {
        return p.sizes[it.size].stock;
    }
    // Product level stock
    if (typeof p.stock === 'number') return p.stock;

    return Infinity;
}

async function initCartPage(isReRender = false) {
    const listEl  = document.getElementById('c-items');
    const totalEl = document.getElementById('cartTotal');
    const coBtn   = document.getElementById('checkoutBtn');

    if (!listEl) return; // Not on cart page

    // Ensure we have fresh stock data
    if (!isReRender) await loadProducts();

    const key = it => it.cartId || (it.id + '-' + (it.size||'') + '-' + (it.color||''));

    // 1. Handle Empty Cart
    if (!cart.length){
        listEl.innerHTML = '<div class="c-empty">Your cart is empty.</div>';
        if(totalEl) totalEl.textContent = '£0.00';
        if(coBtn) coBtn.hidden = true;
        return;
    }
    if(coBtn) {
        coBtn.hidden = false;
        coBtn.onclick = handleCheckout; // Bind checkout
    }

    // 2. Render Items
    listEl.innerHTML = cart.map(it => {
        const unit = Number(it.price ?? (it.priceInPence/100));
        let   qty  = it.quantity || 1;
        const img  = it.image || (it.images && it.images[0]) || '';
        const meta = [it.size, it.color].filter(Boolean).join(' / ') || '-';
        const max  = maxForItem(it, allProducts);
        const productUrl = `product.html?id=${it.id}`; // Link URL

        // auto-clamp logic on render
        if (Number.isFinite(max) && qty > max) {
            qty = it.quantity = max;
            saveCart(); // save clamped value
        }

        const sub = unit * qty;

        return `
          <div class="c-line" data-id="${key(it)}" data-unit="${unit}" data-max="${max}">
            <div class="c-thumb">
                ${img ? `<a href="${productUrl}"><img src="${img}" alt="${it.name}"></a>` : ''}
            </div>
        
            <div class="c-main">
              <div class="c-name">
                  <a href="${productUrl}" style="color:inherit; text-decoration:none;">${it.name}</a>
              </div>
              <div class="c-meta">${meta}</div>
              ${Number.isFinite(max) ? `<div class="c-stock-note">Only ${max} left</div>` : ``}
              <button class="c-remove" type="button" title="Remove">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 4v8m4-8v8m4-8v8"/></svg>
              </button>
            </div>
        
            <div class="c-price">£${unit.toFixed(2)}</div>
        
            <div class="c-qtycol">
              <div class="c-qty">
                <button class="c-qtybtn" data-d="-1" aria-label="Decrease">−</button>
                <input class="qty-input" type="number" min="1" value="${qty}">
                <button class="c-qtybtn" data-d="1" aria-label="Increase">+</button>
              </div>
            </div>
        
            <div class="c-sub"><strong>£${sub.toFixed(2)}</strong></div>
          </div>`;
    }).join('');

    // 3. Render Total
    const grand = cart.reduce((sum,it)=>{
        const unit = Number(it.price ?? (it.priceInPence/100));
        return sum + unit * (it.quantity || 1);
    },0);
    if(totalEl) totalEl.textContent = '£' + grand.toFixed(2);

    // 4. Attach Listeners (Qty & Remove)
    listEl.querySelectorAll('.c-line').forEach(row => {
        const cartId = row.dataset.id;
        const minus  = row.querySelector('[data-d="-1"]');
        const plus   = row.querySelector('[data-d="1"]');
        const input  = row.querySelector('.qty-input');
        const subEl  = row.querySelector('.c-sub strong');
        const max    = Number(row.dataset.max);
        const lim    = Number.isFinite(max) ? max : Infinity;

        // Internal update function
        function setQty(next) {
            const desired = parseInt(next, 10);
            const clamped = Math.max(1, Math.min(lim, isNaN(desired) ? 1 : desired));

            // update global cart state
            const i = cart.findIndex(x => key(x) === cartId);
            if (i < 0) return;
            cart[i].quantity = clamped;
            saveCart(); // persists to LS and updates header badge

            // update local DOM
            input.value = clamped;
            const unit = Number(cart[i].price ?? (cart[i].priceInPence/100));
            subEl.textContent = '£' + (unit * clamped).toFixed(2);

            // Update Grand Total
            const newGrand = cart.reduce((s,it) => s + (Number(it.price||0) * (it.quantity||1)), 0);
            if(totalEl) totalEl.textContent = '£' + newGrand.toFixed(2);

            // Disable buttons at bounds
            if(minus) minus.disabled = (clamped <= 1);
            if(plus)  plus.disabled  = (clamped >= lim && Number.isFinite(lim));
        }

        // Initial button state
        setQty(input.value);

        if(minus) minus.onclick = (e) => { e.preventDefault(); setQty((parseInt(input.value||'1',10) - 1)); };
        if(plus)  plus.onclick  = (e) => { e.preventDefault(); setQty((parseInt(input.value||'1',10) + 1)); };
        if(input) input.onchange = (e) => setQty(e.target.value);

        // Remove button
        const rmBtn = row.querySelector('.c-remove');
        if(rmBtn) rmBtn.onclick = () => removeFromCart(cartId);
    });
}


/* ===================== STRIPE CHECKOUT ===================== */
async function handleCheckout() {
    const btn = $('#checkoutBtn') || $('#checkout-button');
    if (!btn) return;

    if (typeof Stripe === 'undefined') { toast('Payment error. Please refresh.', true); return; }
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes('REPLACE_ME')) {
        toast('Payment setup incomplete. Admin action required.', true); return;
    }

    btn.disabled = true; btn.textContent = 'Processing…';
    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    try {
        const payloadItems = cart.map(it => ({
            id: it.id, quantity: it.quantity || 1, size: it.size, color: it.color
        }));
        const basePath = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');

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
        updateCartUI(); // badge

        const path = location.pathname;

        if (path.endsWith('product.html')) {
            renderProduct();
        } else if (path.endsWith('cart.html')) {
            // Use the specialized cart page logic
            initCartPage();
        } else if (path.endsWith('/') || path.endsWith('index.html')) {
            renderHome();
        }
    } catch (e) {
        console.error('Init error:', e);
        const body = $('body');
        if (body) body.innerHTML = `<h1>Error</h1><p>Could not load products.</p>`;
    }
}

// Start app
router();