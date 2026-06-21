const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/orders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-restaurant-slug': 'demo',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('RESPONSE:', data));
});

const postData = JSON.stringify({
  customer_name: 'Test Customer',
  phone: '1234567890',
  items: [{ product_id: 'bd846630-5cc4-4783-bdf4-4156fe28c45c', quantity: 1, price_at_purchase: 10.0 }],
  party_size: 2
});

req.write(postData);
req.end();
