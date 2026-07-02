const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'src/lib/db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

// Update createOrder signature
content = content.replace(
  /export async function createOrder\(data: \{([\s\S]*?)items: \{ product_id: string; quantity: number; price_at_purchase: number \}\[\];\n\}\)/m,
  "export async function createOrder(data: {$1staff_id?: string;\n  items: { product_id: string; quantity: number; price_at_purchase: number }[];\n})"
);

// Update INSERT INTO orders
content = content.replace(
  /INSERT INTO orders \(restaurant_id, queue_id, user_id, customer_name, phone, total_price, status, is_paid, notes, party_size, ticket_number, table_number\)/g,
  "INSERT INTO orders (restaurant_id, queue_id, user_id, customer_name, phone, total_price, status, is_paid, notes, party_size, ticket_number, table_number, staff_id)"
);

content = content.replace(
  /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, false, \$8, \$9, \$10, \$11\)/g,
  "VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12)"
);

content = content.replace(
  /\[data\.restaurant_id, queueId, userId, data\.customer_name, data\.phone, computedTotal, defaultStatus, data\.notes \|\| null, data\.party_size \|\| 1, nextToken, data\.table_number \|\| null\]/g,
  "[data.restaurant_id, queueId, userId, data.customer_name, data.phone, computedTotal, defaultStatus, data.notes || null, data.party_size || 1, nextToken, data.table_number || null, data.staff_id || null]"
);

// We need to carefully replace SELECT o.* with SELECT o.*, s.name as staff_name 
// AND add LEFT JOIN staffs s ON s.id = o.staff_id
// Because it can be in `FROM orders o\n` or `FROM orders o\r\n` or `LEFT JOIN order_items oi ON oi.order_id = o.id`

content = content.replace(/SELECT o\.\*, /g, "SELECT o.*, s.name as staff_name, ");

// Add LEFT JOIN staffs s ON s.id = o.staff_id to all FROM orders o
// We'll replace "FROM orders o" followed by any whitespace or newline
// Wait, replacing "FROM orders o" with "FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id" should be sufficient globally
// Let's ensure we don't duplicate it.

content = content.split('FROM orders o').join('FROM orders o LEFT JOIN staffs s ON s.id = o.staff_id');
// Wait, if it says `LEFT JOIN staffs s ON s.id = o.staff_id LEFT JOIN staffs s ON s.id = o.staff_id` - we didn't add it before, so it should be fine.

// Let's remove any potential duplicates if we run this twice.
content = content.replace(/LEFT JOIN staffs s ON s\.id = o\.staff_id LEFT JOIN staffs s ON s\.id = o\.staff_id/g, "LEFT JOIN staffs s ON s.id = o.staff_id");
content = content.replace(/s\.name as staff_name, s\.name as staff_name,/g, "s.name as staff_name,");

fs.writeFileSync(dbPath, content, 'utf8');
console.log('src/lib/db.ts updated successfully.');
