import { PRODUCTS } from './products.js';

const fmt = new Intl.NumberFormat(undefined,{style:'currency',currency:'GBP'});

function renderCatalogue(){
  const root = document.getElementById('catalogue');
  root.innerHTML = '';
  PRODUCTS.forEach(p => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="thumb" style="background-image:url('${p.image.replaceAll("'","%27")}')"></div>
      <div class="info">
        <h3 class="title">${p.name}</h3>
        <p class="price">${fmt.format(p.price)}</p>
      </div>
      <div class="sizes" role="group" aria-label="Select a size"></div>
      <div class="actions">
        <a class="btn" target="_blank" rel="noopener" href="${p.stripeLink}">Buy with card</a>
        <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank" class="paypal-form" style="flex:1">
          <input type="hidden" name="cmd" value="_s-xclick" />
          <input type="hidden" name="hosted_button_id" value="${p.paypalButtonId}" />
          <input type="hidden" name="os0" value="" class="pp-size" />
          <button class="btn paypal" type="submit">PayPal</button>
        </form>
      </div>
    `;
    const sizeWrap = card.querySelector('.sizes');
    p.sizes.forEach((s, idx) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.setAttribute('aria-pressed', idx===0 ? 'true' : 'false');
      b.addEventListener('click', () => {
        sizeWrap.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));
        b.setAttribute('aria-pressed','true');
        card.querySelector('.pp-size').value = s; // pass size to PayPal
      });
      sizeWrap.appendChild(b);
    });
    // default PayPal size
    card.querySelector('.pp-size').value = p.sizes[0];
    root.appendChild(card);
  });
}

document.getElementById('year').textContent = new Date().getFullYear();
renderCatalogue();
