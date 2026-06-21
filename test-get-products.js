const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/products?all=true',
  method: 'GET',
  headers: {
    'x-restaurant-slug': 'demo',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const products = JSON.parse(data).data;
    if (products && products.length > 0) {
      console.log('PRODUCT_ID:', products[0].id);
    } else {
      console.log('No products found');
    }
  });
});

req.on('error', (e) => console.error(e));
req.end();
