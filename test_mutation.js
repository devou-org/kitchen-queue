const http = require('http');
const { SignJWT } = require('jose');

async function generateTestToken() {
  const secretBytes = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_for_culinary_conductor');
  const token = await new SignJWT({ userId: 'admin', isAdmin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes);
  return token;
}

async function runTest() {
  const token = await generateTestToken();
  const headers = {
    'Cookie': `admin_token=${token}`,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Get a product
  const getRes = await fetch('http://localhost:3000/api/products', { headers });
  const getData = await getRes.json();
  const firstProduct = getData.data?.[0];
  
  if (!firstProduct) {
     console.log("No product found to edit");
     return;
  }

  console.log(`Editing Product: ${firstProduct.id}`);

  const putRes = await fetch(`http://localhost:3000/api/products/${firstProduct.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      price: 260.00
    })
  });
  
  const putData = await putRes.json();
  console.log("PUT Response:");
  console.log(putData);

  const delRes = await fetch(`http://localhost:3000/api/products/${firstProduct.id}`, {
    method: 'DELETE',
    headers
  });
  const delData = await delRes.json();
  console.log("DELETE Response:");
  console.log(delData);

  // Restore via DB directly
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  await sql`UPDATE products SET is_active = true WHERE id = ${firstProduct.id}`;
  console.log("RESTORED product back to active");
}

runTest().catch(console.error);
