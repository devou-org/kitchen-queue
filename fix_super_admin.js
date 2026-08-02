const fs = require('fs');

let code = fs.readFileSync('src/app/super-admin/restaurants/[id]/page.tsx', 'utf8');

// Add GST states
code = code.replace(
  /const \[rolloverTime, setRolloverTime\] = useState\('00:00:00'\);/,
  `const [rolloverTime, setRolloverTime] = useState('00:00:00');
  const [gstType, setGstType] = useState('NONE');
  const [gstNumber, setGstNumber] = useState('');
  const [gstRate, setGstRate] = useState(5.00);`
);

// Populate states from API
code = code.replace(
  /setRolloverTime\(restaurant\.rollover_time \|\| '00:00:00'\);/,
  `setRolloverTime(restaurant.rollover_time || '00:00:00');
        setGstType(restaurant.gst_type || 'NONE');
        setGstNumber(restaurant.gst_number || '');
        setGstRate(Number(restaurant.gst_rate || 0) || (restaurant.gst_type !== 'NONE' ? 5 : 0));`
);

// Add to payload
code = code.replace(
  /rollover_time: rolloverTime,/,
  `rollover_time: rolloverTime,
          gst_type: gstType,
          gst_number: gstNumber || null,
          gst_rate: Number(gstRate),`
);

// UI Field for GST Type
const gstUI = `                {/* GST Settings */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', gridColumn: '1 / -1' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>GST Settings</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={S.label}>GST Type</label>
                      <select value={gstType} onChange={e => {
                        setGstType(e.target.value);
                        if (e.target.value === 'NONE') setGstRate(0);
                        else if (gstRate === 0) setGstRate(5);
                      }} style={S.input}>
                        <option value="NONE">None (No GST)</option>
                        <option value="REGULAR">Regular (Show separately)</option>
                        <option value="COMPOSITION">Composition (Included in price)</option>
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>GST Number {gstType !== 'NONE' && '*'}</label>
                      <input type="text" value={gstNumber} onChange={e => setGstNumber(e.target.value)} disabled={gstType === 'NONE'} style={S.input} placeholder="e.g. 29ABCDE1234F1Z5" />
                    </div>
                    <div>
                      <label style={S.label}>GST Rate (%) {gstType !== 'NONE' && '*'}</label>
                      <input type="number" step="0.01" value={gstRate} onChange={e => setGstRate(parseFloat(e.target.value) || 0)} disabled={gstType === 'NONE'} style={S.input} />
                    </div>
                  </div>
                </div>

                <div>`;

code = code.replace(
  /                <div>\s*<label style=\{S\.label\}>Rollover Time/,
  gstUI + `\n                  <label style={S.label}>Rollover Time`
);

fs.writeFileSync('src/app/super-admin/restaurants/[id]/page.tsx', code);
