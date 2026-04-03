const http = require('http');

async function testUiPayload() {
  const headers = {
    'Content-Type': 'application/json',
    // the UI sends a cookie admin_token
  };

  // We'll generate the same token
  const { SignJWT } = require('jose');
  const secretBytes = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_jwt_key_for_culinary_conductor');
  const token = await new SignJWT({ userId: 'admin', isAdmin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes);
  
  headers['Cookie'] = `admin_token=${token}`;

  try {
    const res = await fetch(`http://localhost:3000/api/orders`, { headers });
    const data = await res.json();
    const order = data.data?.[0];

    const putRes = await fetch(`http://localhost:3000/api/orders/${order.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: "PREPARING" })
    });
    
    console.log("PUT status:", putRes.status);
    console.log("PUT response body:", await putRes.text());
  } catch (err) {
    console.error("Test failed", err);
  }
}

testUiPayload();
