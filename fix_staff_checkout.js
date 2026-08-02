const fs = require('fs');

let code = fs.readFileSync('src/app/[slug]/staff/menu/page.tsx', 'utf8');

// 1. Calculate GST
code = code.replace(
  /const totalPrice = Array\.from\(cart\.values\(\)\)\.reduce\(\(s, i\) => s \+ i\.price \* i\.quantity, 0\);/,
  `let subtotal = Array.from(cart.values()).reduce((s, i) => s + i.price * i.quantity, 0);
  
  let gstAmount = 0;
  let totalPrice = subtotal;
  if (restaurant?.gst_type === 'REGULAR') {
    const rate = Number(restaurant.gst_rate) || 0;
    gstAmount = Math.round((subtotal * rate / 100) * 100) / 100;
    totalPrice = subtotal + gstAmount;
  }`
);

// 2. Add GST to Checkout breakdown
code = code.replace(
  /                <div style=\{\{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var\(--text-secondary\)', marginBottom: '8px' \}\}>\n                  <span>Subtotal<\/span><span>\{formatPrice\(totalPrice\)\}<\/span>\n                <\/div>\n                <div style=\{\{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var\(--border\)' \}\}>\n                  <span>Total<\/span>\n                  <span style=\{\{ color: 'var\(--primary\)' \}\}>\{formatPrice\(totalPrice\)\}<\/span>\n                <\/div>/,
  `                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
                </div>
                {restaurant?.gst_type === 'REGULAR' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span>GST</span><span>{formatPrice(gstAmount)}</span>
                  </div>
                )}
                {restaurant?.gst_type === 'COMPOSITION' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <span>GST</span><span>Included</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '18px', paddingTop: '8px', borderTop: '2px solid var(--border)' }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--primary)' }}>{formatPrice(totalPrice)}</span>
                </div>`
);

fs.writeFileSync('src/app/[slug]/staff/menu/page.tsx', code);
