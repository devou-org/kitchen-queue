const fs = require('fs');

let code = fs.readFileSync('src/lib/db.ts', 'utf8');

// 1. Calculate GST inside updateOrderDetails
code = code.replace(
  /    nextTotalPrice = insertItems\.reduce\(\(acc, item\) => acc \+ \(item\.price_at_purchase \* item\.quantity\), 0\);\n    nextTotalPrice = Math\.round\(nextTotalPrice \* 100\) \/ 100;\n  \}/,
  `    let nextSubtotal = insertItems.reduce((acc, item) => acc + (item.price_at_purchase * item.quantity), 0);
    nextSubtotal = Math.round(nextSubtotal * 100) / 100;
    
    let nextGstAmount = 0;
    nextTotalPrice = nextSubtotal;

    if (existingOrder.gst_type === 'REGULAR') {
      const rate = Number(existingOrder.gst_rate) || 0;
      nextGstAmount = Math.round((nextSubtotal * rate / 100) * 100) / 100;
      nextTotalPrice = nextSubtotal + nextGstAmount;
    }
    
    // We will update these below
    data.subtotal = nextSubtotal;
    data.gst_amount = nextGstAmount;
  }`
);

// 2. Add subtotal and gst_amount to the UPDATE query
code = code.replace(
  /        table_number = COALESCE\(\$\{data\.table_number \?\? null\}, table_number\),\n        total_price = \$\{nextTotalPrice\},\n        updated_at = NOW\(\)/,
  `        table_number = COALESCE(\${data.table_number ?? null}, table_number),
        total_price = \${nextTotalPrice},
        subtotal = COALESCE(\${data.subtotal ?? null}, subtotal),
        gst_amount = COALESCE(\${data.gst_amount ?? null}, gst_amount),
        updated_at = NOW()`
);

fs.writeFileSync('src/lib/db.ts', code);
