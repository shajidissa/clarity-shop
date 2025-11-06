// Product catalog and payment links
// Replace the Stripe Payment Links and PayPal hosted_button_id values with your own (search TODO).

export const PRODUCTS = [
  {
    id: 'tee-001',
    name: 'Classic Logo Tee',
    price: 24.99,
    image: './assets/images/shirt1.jpg',
    sizes: ['S','M','L','XL'],
    stripeLink: 'https://buy.stripe.com/test_1234567890abcdef', // TODO replace
    paypalButtonId: 'HOSTED_BUTTON_ID_TEE', // TODO replace
  },
  {
    id: 'hood-002',
    name: 'Heavyweight Hoodie',
    price: 49.99,
    image: './assets/images/hoodie.jpg',
    sizes: ['S','M','L','XL'],
    stripeLink: 'https://buy.stripe.com/test_abcdefghij12345', // TODO replace
    paypalButtonId: 'HOSTED_BUTTON_ID_HOOD', // TODO replace
  },
  {
    id: 'cap-003',
    name: 'Embroidered Cap',
    price: 19.99,
    image: './assets/images/cap.jpg',
    sizes: ['One Size'],
    stripeLink: 'https://buy.stripe.com/test_lmnopqrstuv98765', // TODO replace
    paypalButtonId: 'HOSTED_BUTTON_ID_CAP', // TODO replace
  }
];
