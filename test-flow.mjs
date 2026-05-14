import fetch from 'node-fetch'; // Next.js 18+ Node environments have global fetch

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Checkout Flow Tests...\n');

  const testPhone = '9999999999';
  let otpToken = '';
  let otpCode = '';
  let accessToken = '';

  // 1. Test Send OTP
  console.log('👉 Testing: /api/auth/send-otp');
  const sendOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: testPhone })
  });
  const sendOtpData = await sendOtpRes.json();
  
  if (sendOtpData.success && sendOtpData.otp_token) {
    console.log('✅ Send OTP successful. Received token.');
    otpToken = sendOtpData.otp_token;
    
    // Decode JWT payload to get the OTP (it's base64 encoded in the middle segment)
    const payloadB64 = otpToken.split('.')[1];
    const payloadStr = Buffer.from(payloadB64, 'base64').toString('utf-8');
    const payload = JSON.parse(payloadStr);
    otpCode = payload.otp;
    console.log(`🔍 Decoded OTP from token: ${otpCode}`);
  } else {
    console.error('❌ Send OTP failed:', sendOtpData);
    return;
  }

  // 2. Test Verify OTP
  console.log('\n👉 Testing: /api/auth/verify-otp');
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: otpCode, otp_token: otpToken })
  });
  const verifyData = await verifyRes.json();

  if (verifyData.success && verifyData.token) {
    console.log('✅ Verify OTP successful. Received access token.');
    accessToken = verifyData.token;
    console.log('👤 User data:', verifyData.user);
    if (verifyData.user.is_phone_verified === true) {
       console.log('✅ User correctly marked as phone_verified.');
    } else {
       console.error('❌ User is NOT marked as phone_verified.');
    }
  } else {
    console.error('❌ Verify OTP failed:', verifyData);
    return;
  }

  // 3. Test Refresh Token
  console.log('\n👉 Testing: /api/auth/refresh');
  // Need to extract the refresh_token cookie from the verify response
  const cookies = verifyRes.headers.raw()['set-cookie'] || [];
  const refreshTokenCookie = cookies.find(c => c.startsWith('refresh_token='));
  
  if (!refreshTokenCookie) {
    console.error('❌ No refresh_token cookie returned from verify-otp');
    return;
  }

  const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 
      'Cookie': refreshTokenCookie 
    }
  });
  const refreshData = await refreshRes.json();

  if (refreshData.success && refreshData.token) {
    console.log('✅ Token Refresh successful. Received new access token.');
  } else {
    console.error('❌ Token Refresh failed:', refreshData);
  }

  // 4. Test Place Order
  console.log('\n👉 Testing: /api/orders (Create Order)');
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      customer_name: 'Test Automation',
      phone: testPhone,
      party_size: 2,
      notes: 'Test order from automated script',
      items: [
        { product_id: '123', quantity: 1, price_at_purchase: 100 }
      ]
    })
  });
  const orderData = await orderRes.json();

  if (orderRes.ok && orderData.success) {
    console.log(`✅ Order placed successfully! Ticket Number: ${orderData.data.ticket_number}`);
  } else {
    console.error('❌ Place Order failed:', orderRes.status, orderData);
  }

  console.log('\n🎉 All tests completed!');
}

runTests().catch(console.error);
