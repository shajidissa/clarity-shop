/* ===================== CONFIG ===================== */
const NETLIFY_FUNCTION_URL =
    'https://stripe-functions-clarity.netlify.app/.netlify/functions/create-checkout'; // your function

const STRIPE_PUBLISHABLE_KEY = 'pk_test_51SU8YDAGUzM7chQmp0Fm1ytVRWShLxBbjivs06CO9vatcMkKx2MHv1imGCM4RDeMFm4Nn4mabIR4X2Oc71xq9r0P00jpZECTr0';

const MINI_AUTO_HIDE_MS = 2200;

/* ===================== STATE ===================== */
let cart = JSON.parse(localStorage.getItem('clarityCart')) || [];
let allProducts = [];
let miniCartBooted = false;
let miniAutoTimer = null;

/* ===================== HELPERS ===================== */
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const isMobile = () => window.matchMedia('(max-width:900px)').matches;
const money = (n)=> '£' + Number(n).toFixed(2);
const slug  = (s)=> String(s||'').trim().toLowerCase().replace(/\s+/g,'-');

function saveCart() {
    localStorage.setItem('clarityCart', JSON.stringify(cart));
    updateCartUI();
}

function toast(message, isError = false) {
    const t = $('#toast'); if (!t) return;
    t.textContent = message;
    t.style.backgroundColor = isError ? '#d9534f' : '#111';
    t.hidden = false; t.classList.add('show');
    const live = $('#live'); if (live) live.textContent = message;
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.hidden = true, 300); }, 2000);
}

/* ---------- Variant stock helpers (reads products.json inventory) ---------- */
function getVariantStock(p, size, color) {
    // Back-compat if inventory not present
    if (!p || typeof p.inventory === 'undefined') return p?.stock ?? 0;

    // size + color inventory: inventory.sizeColor[color][size]
    if (p.inventory.sizeColor) {
        const mapForColor = p.inventory.sizeColor[color] || p.inventory.sizeColor[String(color)] || null;
        if (mapForColor && size in mapForColor) return mapForColor[size] ?? 0;
        return 0;
    }

    // size-only inventory: inventory.size[size]
    if (p.inventory.size && size) return p.inventory.size[size] ?? 0;

    return p.stock ?? 0;
}

function sumAllStock(p) {
    if (!p || typeof p.inventory === 'undefined') return p?.stock ?? 0;
    if (p.inventory.sizeColor) {
        return Object.values(p.inventory.sizeColor)
            .flatMap(obj => Object.values(obj))
            .reduce((a,b)=>a+(+b||0), 0);
    }
    if (p.inventory.size) {
        return Object.values(p.inventory.size).reduce((a,b)=>a+(+b||0), 0);
    }
    return p.stock ?? 0;
}

/* NEW: unified availability helper */
function getAvailableFor(p, size, color) {
    return (size || color) ? getVariantStock(p, size, color) : sumAllStock(p);
}

/* NEW: pick the first in-stock size/color for an index card */
function pickFirstInStockVariant(p, sizeSel, colorSel) {
    const sizes  = sizeSel ? Array.from(sizeSel.options).map(o => o.value) : [''];
    const colors = colorSel ? Array.from(colorSel.options).map(o => o.value) : [''];
    for (const s of sizes) {
        for (const c of colors) {
            if ((getVariantStock(p, s, c) || 0) > 0) {
                if (sizeSel)  sizeSel.value  = s;
                if (colorSel) colorSel.value = c;
                return true;
            }
        }
    }
    return false; // nothing in stock
}

/* ---------- Badge: never show 0; avoid flicker ---------- */
function updateCartUI() {
    const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    requestAnimationFrame(() => {
        $$('#cart-count').forEach(el => {
            if (!el) return;
            if (count <= 0) { el.textContent = ''; el.style.visibility = 'hidden'; }
            else { el.textContent = count; el.style.visibility = 'visible'; }
            const link = el.closest('.cart-link');
            if (link && count > 0 && !link.classList.contains('pulse-active')) {
                link.classList.add('pulse', 'pulse-active');
                setTimeout(() => link.classList.remove('pulse', 'pulse-active'), 450);
            }
        });
        if (document.getElementById('miniCartPanel')?.style.display === 'block') {
            renderMiniCartSimple();
        }
    });
}

/* ===================== DATA ===================== */
async function loadProducts() {
    if (allProducts.length) return allProducts;
    try {
        const res = await fetch('products.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to fetch products.json (${res.status})`);
        allProducts = await res.json();
        return allProducts;
    } catch (e) {
        console.error(e);
        return [];
    }
}

/* ===================== HOME (index) ===================== */
async function renderHome() {
    const container = $('#products'); if (!container) return;
    const prods = await loadProducts();

    container.innerHTML = prods.map(p => {
        const imgSrc = (Array.isArray(p.images) && p.images.length ? p.images[0] : p.image);
        const pricePence = p.priceInPence ?? Math.round((p.price || 0) * 100);
        const total = sumAllStock(p);
        const stockText = total > 0 ? (total <= 5 ? `Only ${total} left!` : 'In stock') : 'Out of Stock';

        return `
      <div class="card" data-id="${p.id}">
        <a href="product.html?id=${p.id}">
          <img src="${imgSrc}" alt="${p.name}"/>
        </a>
        <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
        <p class="price">${money(pricePence/100)}</p>
        <p class="stock">${stockText}</p>

        <label for="size-${p.id}" class="visually-hidden">Size</label>
        <select id="size-${p.id}" class="size" ${!p.sizes?.length ? 'hidden' : ''}>
          ${(p.sizes || []).map(s => `<option>${s}</option>`).join('')}
        </select>

        <label for="color-${p.id}" class="visually-hidden">Color</label>
        <select id="color-${p.id}" class="color" ${!p.colors?.length ? 'hidden' : ''}>
          ${(p.colors || []).map(c => `<option>${c}</option>`).join('')}
        </select>

        <button class="add-to-cart" data-id="${p.id}" ${total === 0 ? 'disabled' : ''}>
          ${total === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    `;
    }).join('');

    /* UPDATED: live stock/button + auto-pick first in-stock variant */
    container.querySelectorAll('.card').forEach(card => {
        const id = Number(card.dataset.id);
        const p = allProducts.find(x => x.id === id);
        if (!p) return;

        const sizeSel  = card.querySelector('.size');
        const colorSel = card.querySelector('.color');
        const stockEl  = card.querySelector('.stock');
        const addBtn   = card.querySelector('.add-to-cart');

        const refresh = () => {
            const size  = sizeSel?.value || '';
            const color = colorSel?.value || '';
            const available = getAvailableFor(p, size, color);

            if (stockEl) {
                stockEl.textContent = available > 0
                    ? (available <= 5 ? `Only ${available} left!` : 'In stock')
                    : 'Out of Stock';
            }
            if (addBtn) {
                addBtn.disabled = available <= 0;
                addBtn.textContent = available <= 0 ? 'Out of Stock' : 'Add to Cart';
            }
        };

        // Auto-select the first buyable size/color so the card isn't misleading
        if ((sizeSel && sizeSel.options.length) || (colorSel && colorSel.options.length)) {
            pickFirstInStockVariant(p, sizeSel, colorSel);
        }
        refresh();

        sizeSel?.addEventListener('change', refresh);
        colorSel?.addEventListener('change', refresh);
    });

    $$('.add-to-cart').forEach(btn => {
        btn.onclick = (e) => {
            const card = e.currentTarget.closest('.card');
            const id   = Number(card.dataset.id);
            const size = card.querySelector('.size')?.value || '';
            const color= card.querySelector('.color')?.value || '';
            const p = allProducts.find(x => x.id === id);
            if (!p) return;

            const available = getAvailableFor(p, size, color);
            if (available <= 0) { toast('This variant is out of stock.', true); return; }

            addToCart({
                id: p.id, name: p.name,
                price: p.price, priceInPence: p.priceInPence ?? Math.round((p.price||0)*100),
                image: (Array.isArray(p.images)&&p.images[0]) || p.image,
                images: p.images || [],
                size, color, stock: available
            }, size, color, 1, e.currentTarget);
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
        <p class="price">${money(pricePence/100)}</p>
        <p class="stock"></p>

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
            <button type="button" class="qty-btn" data-delta="-1" aria-label="Decrease">−</button>
            <input id="pdQty" class="qty-input" type="number" min="1" value="1" inputmode="numeric">
            <button type="button" class="qty-btn" data-delta="1" aria-label="Increase">+</button>
          </div>
          <button id="add-to-cart-product">Add to Cart</button>
        </div>
      </aside>
    </div>
  `;

    const main = mount.querySelector('#pdMain');
    mount.querySelectorAll('.pd-thumb').forEach(btn => {
        btn.addEventListener('click', () => {
            const src = btn.getAttribute('data-src');
            if (src) main.src = src;
            mount.querySelectorAll('.pd-thumb').forEach(b => b.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
    });

    // Variant-aware UI updates
    const sizeSel  = mount.querySelector('#pdSize');
    const colorSel = mount.querySelector('#pdColor');
    const qtyEl    = mount.querySelector('#pdQty');
    const minusBtn = mount.querySelector('.qty-btn[data-delta="-1"]');
    const plusBtn  = mount.querySelector('.qty-btn[data-delta="1"]');
    const addBtn   = mount.querySelector('#add-to-cart-product');
    const stockEl  = mount.querySelector('.pd-info .stock') || mount.querySelector('.stock');

    function currentAvail() {
        const size  = sizeSel ? sizeSel.value : '';
        const color = colorSel ? colorSel.value : '';
        return getVariantStock(p, size, color);
    }

    function updateVariantUI() {
        const avail = currentAvail();
        if (stockEl) stockEl.textContent = avail > 0 ? (avail <= 5 ? `Only ${avail} left!` : 'In stock') : 'Out of Stock';
        if (qtyEl) {
            const v = parseInt(qtyEl.value || '1', 10);
            qtyEl.max = String(Math.max(avail, 1));
            if (v > avail) qtyEl.value = avail > 0 ? avail : 1;
        }
        if (addBtn) addBtn.disabled = avail <= 0;
        if (minusBtn) minusBtn.disabled = (parseInt(qtyEl.value||'1',10) <= 1);
        if (plusBtn)  plusBtn.disabled  = (avail > 0 ? parseInt(qtyEl.value||'1',10) >= avail : true);
    }

    function setQty(val) {
        const avail = currentAvail();
        let v = parseInt(val, 10);
        if (isNaN(v)) v = 1;
        v = Math.max(1, Math.min(avail > 0 ? avail : 1, v));
        qtyEl.value = v;
        updateVariantUI();
    }

    sizeSel?.addEventListener('change', updateVariantUI);
    colorSel?.addEventListener('change', updateVariantUI);
    minusBtn?.addEventListener('click', ()=> setQty(parseInt(qtyEl.value||'1',10)-1));
    plusBtn ?.addEventListener('click', ()=> setQty(parseInt(qtyEl.value||'1',10)+1));
    qtyEl?.addEventListener('change', (e)=> setQty(e.target.value));
    qtyEl?.addEventListener('input',  (e)=> setQty(e.target.value));

    updateVariantUI();

    addBtn?.addEventListener('click', (e) => {
        const size  = sizeSel ? sizeSel.value : '';
        const color = colorSel ? colorSel.value : '';
        const avail = currentAvail();
        if (avail <= 0) { toast('This variant is out of stock.', true); return; }

        const qty = Math.max(1, Math.min(avail, parseInt(qtyEl.value || '1', 10)));
        addToCart({
            id: p.id, name: p.name, price: p.price, priceInPence: pricePence,
            image: images[0], images: p.images || [],
            size, color, stock: avail
        }, size, color, qty, e.currentTarget);

        toast(`Added ${qty} × ${p.name}`);
    });
}

/* ===================== CART SHARED ===================== */
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

    // Use variant stock if provided on prod
    const stock = (typeof prod.stock === 'number') ? prod.stock : Infinity;

    const cartId = `${prod.id}-${size}-${color}`;
    const existing = cart.find(i => i.cartId === cartId);

    if (existing) {
        const current = existing.quantity || 1;
        const next = current + qty;
        if (Number.isFinite(stock) && next > stock) {
            existing.quantity = stock;
            toast(`Only ${stock} in stock — set to ${stock}`, true);
        } else {
            existing.quantity = next;
            toast(`${prod.name} quantity updated`);
        }
    } else {
        if (Number.isFinite(stock) && stock < 1) { toast(`${prod.name} is out of stock!`, true); return; }
        const initialQty = Number.isFinite(stock) ? Math.min(qty, stock) : qty;
        if (Number.isFinite(stock) && qty > stock) toast(`Only ${stock} in stock — added ${stock}`, true);

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

    ensureMiniCartSimple();
    openMiniCartSimple();
    scheduleMiniAutoHide();
}

function removeFromCart(cartId) {
    cart = cart.filter(i => i.cartId !== cartId);
    saveCart();
    if (document.getElementById('c-items')) initCartPage(true);
}

/* ===================== CART PAGE (cart.html) ===================== */
function maxForItem(it, stockData) {
    const p = stockData.find(x => String(x.id) === String(it.id));
    if (!p) return Infinity;
    const s = it.size || '';
    const c = it.color || '';
    const avail = getVariantStock(p, s, c);
    if (typeof avail === 'number') return avail;
    return p.stock ?? Infinity;
}

async function initCartPage(isReRender = false) {
    const listEl  = document.getElementById('c-items');
    const totalEl = document.getElementById('cartTotal');
    const coBtn   = document.getElementById('checkoutBtn');
    if (!listEl) return;
    if (!isReRender) await loadProducts();

    const key = it => it.cartId || (it.id + '-' + (it.size||'') + '-' + (it.color||''));

    if (!cart.length){
        listEl.innerHTML = '<div class="c-empty">Your cart is empty.</div>';
        if(totalEl) totalEl.textContent = '£0.00';
        if(coBtn) coBtn.hidden = true;
        return;
    }
    if(coBtn) {
        coBtn.hidden = false;
        coBtn.onclick = handleCheckout;
    }

    listEl.innerHTML = cart.map(it => {
        const unit = Number(it.price ?? (it.priceInPence/100));
        let   qty  = it.quantity || 1;
        const img  = it.image || (it.images && it.images[0]) || '';
        const meta = [it.size, it.color].filter(Boolean).join(' / ') || '-';
        const max  = maxForItem(it, allProducts);
        const productUrl = `product.html?id=${it.id}`;

        if (Number.isFinite(max) && qty > max) { qty = it.quantity = max; saveCart(); }
        const sub = unit * qty;

        return `
      <div class="c-line" data-id="${key(it)}" data-unit="${unit}" data-max="${max}">
        <div class="c-thumb">${img ? `<a href="${productUrl}"><img src="${img}" alt="${it.name}"></a>` : ''}</div>
        <div class="c-main">
          <div class="c-name"><a href="${productUrl}" style="color:inherit;text-decoration:none;">${it.name}</a></div>
          <div class="c-meta">${meta}</div>
          ${Number.isFinite(max) ? `<div class="c-stock-note">Only ${max} left</div>` : ``}
          <button class="c-remove" type="button" title="Remove">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 4v8m4-8v8m4-8v8"/></svg>
          </button>
        </div>
        <div class="c-price">${money(unit)}</div>
        <div class="c-qtycol">
          <div class="c-qty">
            <button class="c-qtybtn" data-d="-1" aria-label="Decrease">−</button>
            <input class="qty-input" type="number" min="1" value="${qty}">
            <button class="c-qtybtn" data-d="1" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="c-sub"><strong>${money(sub)}</strong></div>
      </div>`;
    }).join('');

    const grand = cart.reduce((sum,it)=>{
        const unit = Number(it.price ?? (it.priceInPence/100));
        return sum + unit * (it.quantity || 1);
    },0);
    if(totalEl) totalEl.textContent = money(grand);

    listEl.querySelectorAll('.c-line').forEach(row => {
        const cartId = row.dataset.id;
        const minus  = row.querySelector('[data-d="-1"]');
        const plus   = row.querySelector('[data-d="1"]');
        const input  = row.querySelector('.qty-input');
        const subEl  = row.querySelector('.c-sub strong');
        const max    = Number(row.dataset.max);
        const lim    = Number.isFinite(max) ? max : Infinity;

        function setQty(next) {
            const desired = parseInt(next, 10);
            const clamped = Math.max(1, Math.min(lim, isNaN(desired) ? 1 : desired));
            const i = cart.findIndex(x => x.cartId === cartId || (x.id + '-' + (x.size||'') + '-' + (x.color||'')) === cartId);
            if (i < 0) return;
            cart[i].quantity = clamped;
            saveCart();
            input.value = clamped;
            const unit = Number(cart[i].price ?? (cart[i].priceInPence/100));
            subEl.textContent = money(unit * clamped);
            const newGrand = cart.reduce((s,it) => s + (Number(it.price ?? (it.priceInPence/100)) * (it.quantity||1)), 0);
            const totalEl = document.getElementById('cartTotal');
            if(totalEl) totalEl.textContent = money(newGrand);
            if(minus) minus.disabled = (clamped <= 1);
            if(plus)  plus.disabled  = (clamped >= lim && Number.isFinite(lim));
        }
        setQty(input.value);

        minus?.addEventListener('click',(e)=>{ e.preventDefault(); setQty((parseInt(input.value||'1',10) - 1)); });
        plus ?.addEventListener('click',(e)=>{ e.preventDefault(); setQty((parseInt(input.value||'1',10) + 1)); });
        input?.addEventListener('change',(e)=> setQty(e.target.value));

        const rmBtn = row.querySelector('.c-remove');
        rmBtn?.addEventListener('click', ()=> removeFromCart(cartId));
    });
}

/* ===================== SIMPLE MINI CART ===================== */
function ensureMiniCartSimple() {
    if (miniCartBooted) return;
    miniCartBooted = true;

    if (!document.getElementById('miniCartPanel')) {
        const panel = document.createElement('div');
        panel.id = 'miniCartPanel';
        panel.setAttribute('role','dialog');
        panel.style.cssText = `
      position:fixed; z-index:1200; right:12px;
      top:calc(var(--header-h, 86px) + 10px);
      width:360px; max-width:calc(100vw - 24px); max-height:70vh; overflow:auto;
      background:#fff; border:1px solid #eceff1; border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,.15);
      display:none;
    `;
        panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #eef1f4">
        <strong>Your cart (<span id="mc-count">0</span>)</strong>
        <button id="mc-close" style="background:transparent;border:none;font-size:20px;cursor:pointer">×</button>
      </div>
      <div id="mc-items" style="padding:10px"></div>
      <div style="padding:10px 12px;border-top:1px solid #eef1f4">
        <div style="display:flex;justify-content:space-between;margin-bottom:10px">
          <span>Total</span><strong id="mc-total">£0.00</strong>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <a href="cart.html" class="c-btn c-btn-outline" style="text-decoration:none;padding:8px 12px;border:1px solid #111;border-radius:8px">View cart</a>
          <button id="mc-checkout" class="c-btn c-btn-primary" style="padding:8px 12px;border:none;border-radius:8px;background:#d32f2f;color:#fff">Checkout</button>
        </div>
      </div>
    `;
        document.body.appendChild(panel);

        panel.addEventListener('mouseenter', () => { if (miniAutoTimer) { clearTimeout(miniAutoTimer); miniAutoTimer = null; } });
        panel.addEventListener('mouseleave', () => scheduleMiniAutoHide());
        panel.addEventListener('touchstart', () => { if (miniAutoTimer) { clearTimeout(miniAutoTimer); miniAutoTimer = null; } }, { passive: true });

        $('#mc-close')?.addEventListener('click', closeMiniCartSimple);
        $('#mc-checkout')?.addEventListener('click', (e) => handleCheckout(e));
    }
}
function renderMiniCartSimple() {
    const panel  = $('#miniCartPanel'); if (!panel) return;
    const itemsEl = $('#mc-items'); const totalEl = $('#mc-total'); const countEl = $('#mc-count');
    if (!itemsEl || !totalEl || !countEl) return;

    if (!cart.length) {
        itemsEl.innerHTML = `<div class="c-empty">Your cart is empty.</div>`;
        totalEl.textContent = '£0.00';
        countEl.textContent = '0';
        return;
    }

    const html = cart.map(it => {
        const unit = Number(it.price ?? (it.priceInPence/100));
        const sub  = unit * (it.quantity || 1);
        theImg  = it.image || (it.images && it.images[0]) || '';
        const meta = [it.size, it.color].filter(Boolean).join(' / ') || '-';
        const productUrl = `product.html?id=${it.id}`;
        return `
      <div style="display:grid;grid-template-columns:56px 1fr auto;gap:10px;align-items:center;
                  border:1px solid #f1f3f6;border-radius:10px;padding:8px;margin-bottom:8px">
        <div>${theImg ? `<a href="${productUrl}"><img src="${theImg}" alt="${it.name}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #eef1f4"></a>` : ''}</div>
        <div>
          <div style="font-weight:700"><a href="${productUrl}" style="color:inherit;text-decoration:none">${it.name}</a></div>
          <div style="color:#6b7280;font-size:.9rem">${meta || '-'}</div>
          <div style="display:inline-grid;grid-template-columns:28px 46px 28px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:6px">
            <button data-act="dec" data-id="${it.cartId}" style="background:#fff;border:none;border-right:1px solid #e5e7eb;padding:.35rem 0;cursor:pointer">−</button>
            <input data-role="qty" data-id="${it.cartId}" value="${it.quantity||1}" type="number" min="1" style="width:46px;text-align:center;border:none;outline:none;padding:.35rem 0">
            <button data-act="inc" data-id="${it.cartId}" style="background:#fff;border:none;border-left:1px solid #e5e7eb;padding:.35rem 0;cursor:pointer">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800">${money(sub)}</div>
          <button data-act="rm" data-id="${it.cartId}" title="Remove" style="background:transparent;border:none;color:#d20000;cursor:pointer;margin-top:4px">🗑️</button>
        </div>
      </div>`;
    }).join('');

    itemsEl.innerHTML = html;

    const grand = cart.reduce((sum,it)=>{
        const unit = Number(it.price ?? (it.priceInPence/100));
        return sum + unit * (it.quantity || 1);
    },0);
    totalEl.textContent = money(grand);
    countEl.textContent = String(cart.reduce((s,i)=>s+(i.quantity||1),0));

    itemsEl.querySelectorAll('[data-act="dec"]').forEach(b => b.onclick = () => { adjQty(b.dataset.id, -1); scheduleMiniAutoHide(); });
    itemsEl.querySelectorAll('[data-act="inc"]').forEach(b => b.onclick = () => { adjQty(b.dataset.id, +1); scheduleMiniAutoHide(); });
    itemsEl.querySelectorAll('[data-act="rm"]').forEach(b => b.onclick  = () => { removeFromCart(b.dataset.id); renderMiniCartSimple(); scheduleMiniAutoHide(); });
    itemsEl.querySelectorAll('input[data-role="qty"]').forEach(inp => {
        inp.onchange = () => { setQty(inp.dataset.id, inp.value); scheduleMiniAutoHide(); };
    });
}
function adjQty(cartId, delta) {
    const i = cart.findIndex(it => it.cartId === cartId); if (i < 0) return;
    const lim = Number.isFinite(cart[i].stock) ? Math.max(1, cart[i].stock || 1) : Infinity;
    const next = Math.max(1, Math.min(lim, (cart[i].quantity || 1) + delta));
    cart[i].quantity = next;
    saveCart();
    renderMiniCartSimple();
}
function setQty(cartId, val) {
    const i = cart.findIndex(it => it.cartId === cartId); if (i < 0) return;
    const lim = Number.isFinite(cart[i].stock) ? Math.max(1, cart[i].stock || 1) : Infinity;
    let next = parseInt(val,10); if (isNaN(next)) next = 1;
    next = Math.max(1, Math.min(lim, next));
    cart[i].quantity = next;
    saveCart();
    renderMiniCartSimple();
}
function openMiniCartSimple() {
    const panel = $('#miniCartPanel');
    if (!panel) return;
    panel.style.width = isMobile() ? '92vw' : '360px';
    panel.style.display = 'block';
    renderMiniCartSimple();
}
function closeMiniCartSimple() {
    const panel = $('#miniCartPanel');
    if (panel) panel.style.display = 'none';
}
function scheduleMiniAutoHide() {
    if (miniAutoTimer) clearTimeout(miniAutoTimer);
    miniAutoTimer = setTimeout(() => {
        closeMiniCartSimple();
        miniAutoTimer = null;
    }, MINI_AUTO_HIDE_MS);
}

/* ===================== STRIPE CHECKOUT (with 409 handling) ===================== */
function clampCartAfter409(payload){
    const changes = [];
    if (!payload || !Array.isArray(payload.insufficient)) return changes;

    payload.insufficient.forEach(({ key, available }) => {
        // key like "inv:2|m|neon-green"
        const k = String(key).split(':')[1] || '';
        const [id, sizeSlug = '', colorSlug = ''] = k.split('|');

        const idx = cart.findIndex(it =>
            String(it.id) === String(id) &&
            slug(it.size)  === sizeSlug &&
            slug(it.color) === colorSlug
        );
        if (idx >= 0) {
            const item = cart[idx];
            const name = item.name || 'Item';
            const avail = Math.max(0, parseInt(available, 10) || 0);

            if (avail === 0) {
                cart.splice(idx, 1);
                changes.push(`${name} — removed (out of stock)`);
            } else {
                const prev = item.quantity || 1;
                item.quantity = Math.min(prev, avail);
                changes.push(`${name} — set to ${item.quantity} (only ${avail} left)`);
            }
        }
    });

    saveCart();
    if (document.getElementById('c-items')) initCartPage(true);
    return changes;
}

async function handleCheckout(evt) {
    const btn = evt?.currentTarget || $('#checkoutBtn') || $('#checkout-button');
    if (typeof Stripe === 'undefined') { toast('Payment error. Please refresh.', true); return; }
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY.includes('YOUR_STRIPE_PUBLISHABLE_KEY')) {
        toast('Payment setup incomplete. Admin action required.', true); return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }
    const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

    try {
        const payloadItems = cart.map(it => ({
            id: it.id,
            quantity: it.quantity || 1,
            size: it.size,
            color: it.color,
            image: it.image || (it.images && it.images[0]) || ''
        }));

        const basePath = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');

        const res = await fetch(NETLIFY_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payloadItems, basePath })
        });

        if (res.status === 409) {
            const data = await res.json().catch(() => ({}));
            const changes = clampCartAfter409(data);
            ensureMiniCartSimple(); openMiniCartSimple(); scheduleMiniAutoHide();
            toast(changes.length
                ? `Stock changed: ${changes[0]}${changes.length>1 ? ` (+${changes.length-1} more)` : ''}`
                : 'Some items are out of stock. Cart updated.', true);
            if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
            return;
        }

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
        if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
    }
}

/* ===================== ROUTER ===================== */
async function router() {
    try {
        updateCartUI();
        await loadProducts();
        ensureMiniCartSimple();

        const path = location.pathname;
        if (path.endsWith('product.html')) {
            renderProduct();
        } else if (path.endsWith('cart.html')) {
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
router();