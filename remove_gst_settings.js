const fs = require('fs');

let pageCode = fs.readFileSync('src/app/[slug]/admin/settings/page.tsx', 'utf8');

// 1. Remove state variables
pageCode = pageCode.replace(
  /\/\/ GST Settings State[\s\S]*?const \[gstRate, setGstRate\] = useState\(5\.00\);/,
  ''
);

// 2. Remove useEffect
pageCode = pageCode.replace(
  /  useEffect\(\(\) => \{\n    if \(gstType === 'NONE'\) \{\n      setGstRate\(0\);\n    \} else if \(gstRate === 0\) \{\n      setGstRate\(5\);\n    \}\n  \}, \[gstType\]\);/,
  ''
);

// 3. Remove from restaurant useEffect
pageCode = pageCode.replace(
  /      setGstType\(restaurant\.gst_type \|\| 'NONE'\);\n      setGstNumber\(restaurant\.gst_number \|\| ''\);\n      setGstRate\(Number\(restaurant\.gst_rate \|\| 0\) \|\| \(restaurant\.gst_type !== 'NONE' \? 5 : 0\)\);/,
  ''
);

// 4. Remove from PUT body payload
pageCode = pageCode.replace(
  /          gst_type: gstType,\n          gst_number: gstNumber \|\| null,\n          gst_rate: Number\(gstRate\),/,
  ''
);

// 5. Remove UI section
pageCode = pageCode.replace(
  /            \{\/\* GST Configuration \*\/\}(.|\n)*?\{\/\* Theme Colors Configuration \*\/\}/,
  '{/* Theme Colors Configuration */}'
);

fs.writeFileSync('src/app/[slug]/admin/settings/page.tsx', pageCode);

let routeCode = fs.readFileSync('src/app/api/admin/settings/route.ts', 'utf8');

// 1. Remove from destructuring
routeCode = routeCode.replace(
  /      rollover_time,\n      gst_type,\n      gst_number,\n      gst_rate/,
  `      rollover_time`
);

// 2. Remove from UPDATE query
routeCode = routeCode.replace(
  /        rollover_time = \$\{rollover_time \|\| null\},\n        gst_type = \$\{gst_type \|\| 'NONE'\},\n        gst_number = \$\{gst_number \|\| null\},\n        gst_rate = \$\{gst_rate \|\| 0\},\n        updated_at = NOW\(\)/,
  `        rollover_time = \${rollover_time || null},
        updated_at = NOW()`
);

fs.writeFileSync('src/app/api/admin/settings/route.ts', routeCode);
