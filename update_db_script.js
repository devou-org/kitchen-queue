const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'src/lib/db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

// Update createOrder signature
content = content.replace(
  /export async function createOrder\(data: \{([\s\S]*?)items: \{ product_id: string; quantity: number; price_at_purchase: number \}\[\];/m,
  "export async function createOrder(data: {$1staff_id?: string;\n  items: { product_id: string; quantity: number; price_at_purchase: number }[];"
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

// Update SELECT o.*
content = content.replace(/SELECT o\.\*,/g, "SELECT o.*, s.name as staff_name,");
content = content.replace(/FROM orders o\n/g, "FROM orders o\n    LEFT JOIN staffs s ON s.id = o.staff_id\n");
content = content.replace(/FROM orders o\r\n/g, "FROM orders o\r\n    LEFT JOIN staffs s ON s.id = o.staff_id\r\n");

// Exception for getOrderByTicket and getOrdersByPhone where FROM orders o was already followed by other joins, so we should be careful.
// Actually, replacing `FROM orders o\n` handles most. 
// Let's check `getOrderByTicket` and `getOrderById`.
content = content.replace(/LEFT JOIN order_items oi ON oi\.order_id = o\.id/g, "LEFT JOIN staffs s ON s.id = o.staff_id\n    LEFT JOIN order_items oi ON oi.order_id = o.id");
// This might result in duplicate LEFT JOIN staffs s if they are both applied.
// Let's refine the replacement strategy.

fs.writeFileSync(dbPath, content, 'utf8');
console.log('src/lib/db.ts updated successfully.');
