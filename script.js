/* ==== GLOBALS ==== */
const ZAPIER_WEBHOOK   = 'https://hooks.zapier.com/hooks/catch/YOUR/ZAP/ID/'; // <-- replace

let cart = JSON.parse(localStorage.getItem('clarityCart')) || [];

/* ==== HELPERS ==== */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

/* =================== PayPal JS SDK loader (Sandbox) =================== */
const PAYPAL_CLIENT_ID = 'sb';
let _paypalReady = null;
function loadPayPalSdk() {
    if (window.paypal?.Buttons) return Promise.resolve();
    if (_paypalReady) return _paypalReady;

    _paypalReady = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=GBP&components=buttons`;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
    });
    return _paypalReady;
}

function updateCartUI() {
    const count = cart.reduce((s,i)=>s+i.qty,0);
    $$('#cart-count').forEach(el=>el.textContent=count);
}

/* ==== LOAD PRODUCTS ==== */
async function loadProducts() {
    const res = await fetch('products.json');
    return await res.json();
}

/* Render a PayPal "Buy Now" button into `mountEl` for product `p`.
   getSel() must return { size, color } from the current selects. */
async function renderPPButton(mountEl, p, getSel) {
    await loadPayPalSdk();

    // price as string with 2 dp
    const priceStr = (Number(p.price).toFixed(2));

    paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'buynow' },

        createOrder: (data, actions) => {
            const sel = (typeof getSel === 'function') ? getSel() : { size: '', color: '' };
            const size = sel?.size || '';
            const color = sel?.color || '';
            const desc  = [p.name, size && `(${size}`, color && `${size ? ' / ' : '('}${color}`, (size||color) && ')']
                .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

            return actions.order.create({
                purchase_units: [{
                    description: desc || p.name,
                    amount: {
                        currency_code: 'GBP',
                        value: priceStr,
                        breakdown: {
                            item_total: { currency_code: 'GBP', value: priceStr },
                            shipping:   { currency_code: 'GBP', value: '0.00' },
                            handling:   { currency_code: 'GBP', value: '0.00' },
                            tax_total:  { currency_code: 'GBP', value: '0.00' }
                        }
                    },
                    items: [{
                        name: p.name,
                        sku: p.sku || `PID-${p.id}`,
                        quantity: '1',
                        unit_amount: { currency_code: 'GBP', value: priceStr },
                        description: [size, color].filter(Boolean).join(' / ')
                    }]
                }]
            });
        },

        onApprove: (data, actions) =>
            actions.order.capture().then(details => {
                const first = details?.payer?.name?.given_name || 'customer';
                if (typeof toast === 'function') toast(`Thanks, ${first}! Order ${details.id} complete.`);
                console.log('PayPal order:', details);
                // Optional: window.location = `thankyou.html?order=${details.id}`;
            }),

        onError: (err) => {
            console.error('PayPal error:', err);
            if (typeof toast === 'function') toast(`PayPal error: ${err?.message || err}`);
        }
    }).render(mountEl);
}

async function renderHome() {
    const prods = await loadProducts();
    const container = document.getElementById('products');

    container.innerHTML = prods.map(p => `
    <div class="card" data-id="${p.id}">
      <a href="product.html?id=${p.id}">
        <img src="${p.image}" alt="${p.name}"/>
      </a>
      <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
      <p class="price">£${Number(p.price).toFixed(2)}</p>
      <p class="stock">Only ${p.stock} left!</p>

      <label>Size</label>
      <select class="size">${(p.sizes||[]).map(s => `<option>${s}</option>`).join('')}</select>

      <label>Color</label>
      <select class="color">${(p.colors||[]).map(c => `<option>${c}</option>`).join('')}</select>

      <div class="pp-btn" id="pp-btn-${p.id}"></div>
    </div>
  `).join('');

    // Mount the PayPal button for each product
    prods.forEach(p => {
        const card  = container.querySelector(`.card[data-id="${p.id}"]`);
        const mount = card.querySelector(`#pp-btn-${p.id}`);
        const getSel = () => ({
            size:  card.querySelector('.size')?.value,
            color: card.querySelector('.color')?.value
        });
        renderPPButton(mount, p, getSel);
    });
}

/* ========= PRODUCT PAGE ========= */
async function renderProduct() {
    const id = +new URLSearchParams(location.search).get('id');
    const prods = await loadProducts();
    const p = prods.find(x => x.id === id);
    if (!p) { location.href = 'index.html'; return; }

    const crumb = document.getElementById('crumb-name');
    if (crumb) crumb.textContent = p.name;

    document.getElementById('product-detail').innerHTML = `
    <img src="${p.image}" alt="${p.name}"/>
    <div class="info">
      <h1>${p.name}</h1>
      <p class="price">£${Number(p.price).toFixed(2)}</p>
      <p class="stock">Only ${p.stock} left!</p>

      <label>Size</label>
      <select id="size">${(p.sizes||[]).map(s => `<option>${s}</option>`).join('')}</select>

      <label>Color</label>
      <select id="color">${(p.colors||[]).map(c => `<option>${c}</option>`).join('')}</select>

      <div id="pp-btn-product"></div>
    </div>
  `;

    const getSel = () => ({
        size:  document.getElementById('size')?.value,
        color: document.getElementById('color')?.value
    });
    renderPPButton(document.getElementById('pp-btn-product'), p, getSel);
}

/* ==== CART LOGIC ==== */
function addToCart(prod, size, color) {
    const existing = cart.find(i=>i.id===prod.id && i.size===size && i.color===color);
    if (existing) {
        if (existing.qty < prod.stock) existing.qty++;
        else { alert('No more stock!'); return; }
    } else {
        if (prod.stock===0) { alert('Out of stock!'); return; }
        cart.push({id:prod.id, name:prod.name, price:prod.price, size, color, qty:1, image:prod.image, stock:prod.stock});
    }
    saveCart();
}

/* ==== RENDER CART PAGE ==== */
async function renderCart() {
    const itemsWrap = document.getElementById('cart-items');
    const totalEl   = document.getElementById('total');
    const ppMount   = document.getElementById('paypal-button-container');

    // 1) Render your cart items
    if (!cart || cart.length === 0) {
        itemsWrap.innerHTML = `<p>Your cart is empty.</p>`;
        totalEl.textContent = '0.00';
        if (ppMount) ppMount.innerHTML = '';
        return;
    }

    // Simple line items
    itemsWrap.innerHTML = cart.map(it => `
    <div class="cart-line">
      <div class="cart-line__main">
        <strong>${it.name}</strong>
        <div class="muted">${[it.size, it.color].filter(Boolean).join(' / ')}</div>
      </div>
      <div class="cart-line__qty">×${it.qty || 1}</div>
      <div class="cart-line__price">£${(Number(it.price) * (it.qty||1)).toFixed(2)}</div>
    </div>
  `).join('');

    const grandTotal = cart.reduce((sum, it) => sum + Number(it.price) * (it.qty || 1), 0);
    totalEl.textContent = grandTotal.toFixed(2);

    // 2) Load the PayPal SDK (once)
    await loadPayPalSdk();

    // 3) Render the PayPal button
    //    Build the items array for PayPal (1:1 with your cart)
    const items = cart.map(it => ({
        name: it.name,
        sku: it.sku || `PID-${it.id || ''}`.trim(),
        quantity: String(it.qty || 1),
        unit_amount: { currency_code: 'GBP', value: Number(it.price).toFixed(2) },
        description: [it.size, it.color].filter(Boolean).join(' / ')
    }));

    // Make sure container is empty before rendering (avoid duplicate buttons)
    ppMount.innerHTML = '';

    paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'checkout' },

        createOrder: (data, actions) => {
            const amountStr = grandTotal.toFixed(2);

            return actions.order.create({
                purchase_units: [{
                    amount: {
                        currency_code: 'GBP',
                        value: amountStr,
                        breakdown: {
                            item_total: { currency_code: 'GBP', value: amountStr },
                            shipping:   { currency_code: 'GBP', value: '0.00' },
                            handling:   { currency_code: 'GBP', value: '0.00' },
                            tax_total:  { currency_code: 'GBP', value: '0.00' }
                        }
                    },
                    items
                }]
            });
        },

        onApprove: (data, actions) =>
            actions.order.capture().then(details => {
                const first = details?.payer?.name?.given_name || 'customer';
                try { toast && toast(`Thanks, ${first}! Order ${details.id} complete.`); } catch {}
                // Clear cart and persist
                cart = [];
                localStorage.setItem('clarityCart', JSON.stringify(cart));
                // Redirect or show a success message
                window.location.href = 'index.html';
            }),

        onError: (err) => {
            console.error('PayPal error:', err);
            try { toast && toast(`PayPal error: ${err?.message || err}`); } catch {}
        }
    }).render(ppMount);
}

/* ==== EMAIL via Zapier ==== */
async function sendOrderEmail(order, items) {
    const payload = {
        orderId: order.id,
        totalGBP: $('#total').textContent,
        items: items.map(i=>`${i.name} (${i.size}/${i.color}) ×${i.qty}`),
        customerEmail: $('#customer-email') ? $('#customer-email').value.trim() : ''
    };
    await fetch(ZAPIER_WEBHOOK, {
        method:'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

function generatePDF(order, items) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Clarity – Receipt', 20, 20);
    doc.setFontSize(12);
    doc.text(`Order ID: ${order.id}`, 20, 35);
    doc.text(`Total: £${$('#total').textContent}`, 20, 45);
    let y = 60;
    items.forEach(i=>{
        doc.text(`${i.name} – ${i.size}/${i.color} ×${i.qty} – £${(i.price*i.qty).toFixed(2)}`, 20, y);
        y+=10;
    });
    doc.save(`Clarity-receipt-${order.id}.pdf`);
}

/* === helpers (put near your other helpers) === */
function toast(html, ms=1800){
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerHTML = html;
    t.hidden = false;
    requestAnimationFrame(()=> t.classList.add('show'));
    // a11y live announcement
    const live = document.getElementById('live'); if(live) live.textContent = t.textContent;
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.hidden = true, 250); }, ms);
}

/* ==== ROUTER ==== */
if (location.pathname.includes('product.html')) renderProduct();
else if (location.pathname.includes('cart.html')) renderCart();
else renderHome();

updateCartUI();