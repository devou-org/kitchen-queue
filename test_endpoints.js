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

async function runTests() {
  const token = await generateTestToken();
  const headers = {
    'Cookie': `admin_token=${token}`,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const results = [];

  const endpoints = [
    { method: 'GET', url: '/api/products' },
    { method: 'GET', url: '/api/queue/current' },
    { method: 'GET', url: '/api/orders?per_page=5' },
    { method: 'GET', url: '/api/analytics?type=dashboard' },
    { method: 'POST', url: '/api/auth/send-otp', body: { phone: '+10000000000' } },
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(`http://localhost:3000${ep.url}`, {
        method: ep.method,
        headers,
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      const data = await resp.json().catch(() => null);
      results.push({
        endpoint: `${ep.method} ${ep.url}`,
        status: resp.status,
        success: data?.success,
        error: data?.error || (data ? null : 'Failed to parse JSON')
      });
    } catch (err) {
      results.push({
        endpoint: `${ep.method} ${ep.url}`,
        status: 'FAILED',
        error: err.message
      });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);
