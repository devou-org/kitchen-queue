const http = require('http');

async function test() {
  const url = 'http://localhost:3000/api/orders?page=1&per_page=200&date_from=2026-06-23&date_to=2026-06-23&sort=DESC';
  try {
    const res = await fetch(url, {
      headers: {
        'x-restaurant-slug': 'renjzkithcen' // I need to know the correct slug, wait.
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
