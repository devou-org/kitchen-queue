const fs = require('fs');
let code = fs.readFileSync('src/app/[slug]/admin/settings/page.tsx', 'utf8');

// 1. Add state variables
code = code.replace(
  /const \[rolloverTime, setRolloverTime\] = useState\('00:00:00'\);/,
  `const [rolloverTime, setRolloverTime] = useState('00:00:00');
  
  // GST Settings State
  const [gstType, setGstType] = useState('NONE');
  const [gstNumber, setGstNumber] = useState('');
  const [gstRate, setGstRate] = useState(5.00);

  useEffect(() => {
    if (gstType === 'NONE') {
      setGstRate(0);
    } else if (gstRate === 0) {
      setGstRate(5);
    }
  }, [gstType]);`
);

// 2. Add to useEffect
code = code.replace(
  /setRolloverTime\(restaurant\.rollover_time \|\| '00:00:00'\);/,
  `setRolloverTime(restaurant.rollover_time || '00:00:00');
      setGstType(restaurant.gst_type || 'NONE');
      setGstNumber(restaurant.gst_number || '');
      setGstRate(Number(restaurant.gst_rate || 0) || (restaurant.gst_type !== 'NONE' ? 5 : 0));`
);

// 3. Add to API call payload
code = code.replace(
  /rollover_time: rolloverTime,/,
  `rollover_time: rolloverTime,
          gst_type: gstType,
          gst_number: gstNumber || null,
          gst_rate: Number(gstRate),`
);

// 4. Add GST UI Section
code = code.replace(
  /\{\/\* Theme Colors Configuration \*\/\}/,
  `{/* GST Configuration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div>
                <label style={S.label}>GST Type</label>
                <select
                  value={gstType}
                  onChange={e => setGstType(e.target.value)}
                  style={{ ...S.input, backgroundColor: '#ffffff' }}
                >
                  <option value="NONE">None (No GST)</option>
                  <option value="REGULAR">Regular (Show separately)</option>
                  <option value="COMPOSITION">Composition (Included in price)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={S.label}>GST Number {gstType !== 'NONE' && '*'}</label>
                  <input 
                    type="text" 
                    value={gstNumber} 
                    onChange={e => setGstNumber(e.target.value)} 
                    style={S.input} 
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    disabled={gstType === 'NONE'}
                    required={gstType !== 'NONE'}
                  />
                </div>
                <div>
                  <label style={S.label}>GST Rate (%) {gstType !== 'NONE' && '*'}</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={gstRate} 
                    onChange={e => setGstRate(parseFloat(e.target.value) || 0)} 
                    style={S.input} 
                    disabled={gstType === 'NONE'}
                    required={gstType !== 'NONE'}
                  />
                </div>
              </div>
            </div>

            {/* Theme Colors Configuration */}`
);

fs.writeFileSync('src/app/[slug]/admin/settings/page.tsx', code);
