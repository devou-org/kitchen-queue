const { SignJWT } = require('jose');

async function generateTestToken() {
  const secretBytes = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_for_culinary_conductor');
  return await new SignJWT({ userId: 'admin', isAdmin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes);
}

async function runTest() {
  const token = await generateTestToken();
  const headers = {
    'Cookie': `admin_token=${token}`,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Get orders
  const getRes = await fetch('http://localhost:3000/api/orders?per_page=1', { headers });
  const getData = await getRes.json();
  const order = getData.data?.[0];
  
  if (!order) {
    console.log("No order found");
    return;
  }
  
  console.log(`Setting status on Order ${order.id} to PREPARING`);
  const putRes = await fetch(`http://localhost:3000/api/orders/${order.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'PREPARING' })
  });
  
  const putData = await putRes.json();
  console.log("Response:", putData);

  // Restore
  await fetch(`http://localhost:3000/api/orders/${order.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: 'PENDING' })
  });
}

runTest().catch(console.error);
