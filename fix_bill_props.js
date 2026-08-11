
const fs = require('fs');

function addGstNumber(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  code = code.replace(
    /primary_color: restaurant.primary_color,/g,
    `primary_color: restaurant.primary_color,\n            gst_number: restaurant.gst_number,`
  );
  fs.writeFileSync(filePath, code);
}

addGstNumber('src/app/[slug]/admin/statements/page.tsx');
addGstNumber('src/app/[slug]/order-status/[id]/page.tsx');
