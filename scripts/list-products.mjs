const BASE_URL = 'http://localhost:3000';

async function list() {
  const res = await fetch(`${BASE_URL}/api/products`, {
    headers: { 'x-test-bypass': 'true' }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.data.map(p => ({ id: p.id, name: p.name, stock: p.stock_quantity })), null, 2));
}
list();
