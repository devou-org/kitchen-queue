const fs = require('fs');

let code = fs.readFileSync('src/components/BillTemplate.tsx', 'utf8');

// 1. Add GST Number to BillRestaurantInfo
code = code.replace(
  /export interface BillRestaurantInfo \{[\s\S]*?phone\?: string;/,
  `export interface BillRestaurantInfo {
  name: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  gst_number?: string;`
);

// 2. Add GST Number render under Restaurant Info (under Tel)
code = code.replace(
  /\{restaurant\.phone && <><br \/>Tel: \{restaurant\.phone\}<\/>\}/, // wait, it's actually just `{restaurant.phone && <>Tel: {restaurant.phone}</>}`
  `{restaurant.phone && <><br />Tel: {restaurant.phone}</>}
                    {restaurant.gst_number && <><br />GSTIN: <span style={{fontWeight: 700}}>{restaurant.gst_number}</span></>}`
);
code = code.replace(
  /\{restaurant\.phone && <>Tel: \{restaurant\.phone\}<\/>\}/, 
  `{restaurant.phone && <><br />Tel: {restaurant.phone}</>}
                    {restaurant.gst_number && <><br />GSTIN: <span style={{fontWeight: 700}}>{restaurant.gst_number}</span></>}`
);

// 3. Add GST Breakdown above Total
const totalBlockTarget = `              {/* Grand Total */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                marginTop: '4px',
                borderTop: \`2px solid \${primaryColor}\`,
              }}>`;

const gstRender = `              {/* GST Breakdown */}
              {(order as any).gst_type === 'REGULAR' && (order as any).gst_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', color: '#6b7280' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500 }}>GST @ {(order as any).gst_rate}%</span>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatPrice((order as any).gst_amount)}</span>
                </div>
              )}
              {(order as any).gst_type === 'COMPOSITION' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', color: '#6b7280' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, fontStyle: 'italic' }}>(Inclusive of GST)</span>
                  <span></span>
                </div>
              )}

              {/* Grand Total */}`;

code = code.replace(
  /              \{\/\* Grand Total \*\/\}\n              <div style=\{\{\n                display: 'flex',\n                justifyContent: 'space-between',\n                alignItems: 'center',\n                padding: '12px 0',\n                marginTop: '4px',\n                borderTop: `2px solid \$\{primaryColor\}`,\n              \}\}>/,
  gstRender + '\n' + totalBlockTarget
);

fs.writeFileSync('src/components/BillTemplate.tsx', code);
