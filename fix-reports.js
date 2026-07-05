const fs = require('fs');

const path = './src/lib/db.ts';
let code = fs.readFileSync(path, 'utf8');

// Fix getDailySales
code = code.replace(
  /FROM orders JOIN restaurants r ON r\.id = orders\.restaurant_id WHERE orders\.restaurant_id = \s+AND DATE\(created_at\) BETWEEN \$\{dateFrom\} AND \$\{dateTo\}/g,
  \"FROM orders WHERE restaurant_id = ${restaurantId}\\n      AND business_date BETWEEN ${dateFrom} AND ${dateTo}\"
);
code = code.replace(/GROUP BY DATE\(created_at\)/g, 'GROUP BY business_date');

// Fix getPeakHours
code = code.replace(
  /FROM orders JOIN restaurants r ON r\.id = orders\.restaurant_id WHERE orders\.restaurant_id = \s+AND DATE\(created_at\) BETWEEN \$\{dateFrom\} AND \$\{dateTo\}/g,
  \"FROM orders WHERE restaurant_id = ${restaurantId}\\n      AND business_date BETWEEN ${dateFrom} AND ${dateTo}\"
);

// Fix getTopProducts
code = code.replace(
  /WHERE o\.restaurant_id = \$\{restaurantId\}\s+AND DATE\(o\.created_at\) BETWEEN \$\{dateFrom\} AND \$\{dateTo\}/g,
  \"WHERE o.restaurant_id = ${restaurantId}\\n      AND o.business_date BETWEEN ${dateFrom} AND ${dateTo}\"
);

// Fix getDashboardStats
code = code.replace(
  /const today = new Intl\.DateTimeFormat\('en-CA', \{ timeZone: 'Asia\/Kolkata' \}\)\.format\(new Date\(\)\);\s+const statsRows = await sql`\s+SELECT \s+COALESCE\(SUM\(total_price\) FILTER \(WHERE DATE\(created_at\) = \$\{today\} AND is_paid = true AND status = 'PAID'\), 0\) as revenue_today,\s+COUNT\(\*\) FILTER \(WHERE DATE\(created_at\) = \$\{today\} AND is_paid = true AND status = 'PAID'\) as orders_today,\s+COALESCE\(AVG\(total_price\) FILTER \(WHERE DATE\(created_at\) = \$\{today\} AND is_paid = true AND status = 'PAID'\), 0\) as avg_order_value,\s+COUNT\(\*\) FILTER \(WHERE status = 'PENDING'\) as pending_orders\s+FROM orders JOIN restaurants r ON r\.id = orders\.restaurant_id WHERE orders\.restaurant_id = \s+`;/g,
  `  const statsRows = await sql\`
    SELECT 
      COALESCE(SUM(total_price) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = \${restaurantId}) AND is_paid = true AND status = 'PAID'), 0) as revenue_today,
      COUNT(*) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = \${restaurantId}) AND is_paid = true AND status = 'PAID') as orders_today,
      COALESCE(AVG(total_price) FILTER (WHERE business_date = (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = \${restaurantId}) AND is_paid = true AND status = 'PAID'), 0) as avg_order_value,
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders
    FROM orders WHERE restaurant_id = \${restaurantId}
  \`;`
);

fs.writeFileSync(path, code);
console.log('Fixed reporting queries in db.ts!');
