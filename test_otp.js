async function testOTP() {
  const phone = "+919999999999";
  
  // 1. Send OTP
  console.log("Sending OTP to", phone);
  const sendRes = await fetch('http://localhost:3000/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  
  const sendData = await sendRes.json();
  console.log("Send data:", sendData);
  
  // Actually wait, since I can't read the console.log from the Next.js process easily
  // without killing it, I will just write a script that accesses the internal map if it's the exact same process...
  // Wait, my test_otp.js will run in a DIFFERENT Node process!
  // It won't be able to access the OTP sent by `npm run dev`.
}
testOTP();
