const { updateOrderStatus } = require('./src/lib/db'); // this might not work if it's TS

// let's do a fetch instead
const { SignJWT } = require('jose');

async function testApi() {
  const secretBytes = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_for_culinary_conductor');
  const token = await new SignJWT({ userId: 'admin', isAdmin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes);
    
  const headers = {
    'Cookie': `admin_token=${token}`,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const getRes = await fetch('http://localhost:3000/api/orders', { headers });
  const data = await getRes.json();
  const order = data.data?.[0];

  console.log("Found order:", order.id, "current status:", order.status);
  
  const targetStatus = order.status === 'PENDING' ? 'PREPARING' : 'PENDING';

  console.log(`Setting to ${targetStatus}`);
  const putRes = await fetch(`http://localhost:3000/api/orders/${order.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ status: targetStatus })
  });
  
  const text = await putRes.text();
  console.log("API returned:", putRes.status, text);
}

testApi().catch(console.error);
