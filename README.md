# Static Clothing Store (GitHub Pages + Hosted Checkout)

A **pure HTML/CSS/JavaScript** shop you can deploy on **GitHub Pages** and accept payments via **Stripe Payment Links** or **PayPal Hosted Buttons** — no backend required.

## How payments work
- **Stripe Payment Links**: Create a product and price in Stripe → make a Payment Link → paste the link in `assets/js/products.js`.
- **PayPal Hosted Buttons**: Create a “Buy Now” hosted button → copy the `hosted_button_id` → paste in `assets/js/products.js`.

> Security: Checkout happens on Stripe/PayPal's hosted pages; this keeps sensitive payment logic off your static site.

## Quick start
1. Click **Use this template** or download this repo and create a new **public** GitHub repo.
2. Replace placeholder links/IDs in `assets/js/products.js` (search for `TODO`).
3. Commit and push to GitHub.
4. In your repo: **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` (root).
5. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

## Stripe: creating a Payment Link
1. Stripe Dashboard → **Products** → *+ Add product*, set name/price (GBP).
2. **Payment Links** → *Create link* → choose that product/price.
3. Copy the `https://buy.stripe.com/...` link, paste into `stripeLink` fields.

## PayPal: creating a Hosted Button
1. PayPal Business → **Pay & Get Paid → PayPal Buttons → Create new button (Buy Now)**.
2. Configure item name/price/variants (e.g., Size).
3. Save and copy the **hosted_button_id**; paste into `paypalButtonId` fields.
4. If you defined an *Option 1 Name* (like `Size`) in PayPal, keep `os0` in the form and pass the value from your size buttons.

## Customize
- Product list: edit `assets/js/products.js` (name, price, images, sizes, links/ids).
- Theme/colors: edit `assets/css/styles.css`.
- Branding: replace images in `assets/images/` and logo in the header.

## Dev tips
- You can test locally by opening `index.html` directly in your browser.
- No build step, no frameworks — intentionally simple.

## License
MIT © 2025
