const fs = require('fs');

// 1. Modify OrderSummary.tsx
let osCode = fs.readFileSync('src/app/[slug]/checkout/components/OrderSummary.tsx', 'utf8');

// Update props
osCode = osCode.replace(
  /subtotal: number;\n  total: number;/,
  `subtotal: number;\n  gstAmount?: number;\n  gstType?: string;\n  total: number;`
);

// Update destructured props
osCode = osCode.replace(
  /export default function OrderSummary\(\{ items, subtotal, total, addToMode, activeOrder \}: OrderSummaryProps\) \{/,
  `export default function OrderSummary({ items, subtotal, gstAmount, gstType, total, addToMode, activeOrder }: OrderSummaryProps) {`
);

// Update render
osCode = osCode.replace(
  /<div style=\{\{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var\(--text-secondary\)' \}\}>\n              <span>Subtotal \(new items\)<\/span><span>\{formatPrice\(subtotal\)\}<\/span>\n            <\/div>/,
  `<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>Subtotal (new items)</span><span>{formatPrice(subtotal)}</span>
            </div>
            {gstType === 'REGULAR' && gstAmount !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>GST (added to total)</span><span>{formatPrice(gstAmount)}</span>
              </div>
            )}
            {gstType === 'COMPOSITION' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>GST</span><span>Included in price</span>
              </div>
            )}`
);

fs.writeFileSync('src/app/[slug]/checkout/components/OrderSummary.tsx', osCode);

// 2. Modify page.tsx
let cpCode = fs.readFileSync('src/app/[slug]/checkout/page.tsx', 'utf8');

cpCode = cpCode.replace(
  /const subtotal = items.reduce\(\(s, i\) => s \+ i\.price \* i\.quantity, 0\);\n  const total = subtotal;/,
  `const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  
  let gstAmount = 0;
  let total = subtotal;
  if (restaurant?.gst_type === 'REGULAR') {
    const rate = Number(restaurant.gst_rate) || 0;
    gstAmount = Math.round((subtotal * rate / 100) * 100) / 100;
    total = subtotal + gstAmount;
  }`
);

cpCode = cpCode.replace(
  /<OrderSummary \n          items=\{items\}\n          subtotal=\{subtotal\}\n          total=\{total\}\n          addToMode=\{addToMode\}\n          activeOrder=\{activeOrder\}\n        \/>/,
  `<OrderSummary 
          items={items}
          subtotal={subtotal}
          gstAmount={gstAmount}
          gstType={restaurant?.gst_type}
          total={total}
          addToMode={addToMode}
          activeOrder={activeOrder}
        />`
);

fs.writeFileSync('src/app/[slug]/checkout/page.tsx', cpCode);
