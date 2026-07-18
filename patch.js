const fs = require('fs');
let content = fs.readFileSync('src/lib/db.ts', 'utf8');

content = content.replace(
  /queue_type, party_size, notes\s*\) VALUES \(\$1, \$2, \$3, \$4, 'ORDER', \$5, \$6\)/g,
  "queue_type, party_size, notes, business_date\n      ) VALUES ($1, $2, $3, $4, 'ORDER', $5, $6, (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = $1))"
);

content = content.replace(
  /party_size, ticket_number, table_number, staff_id\)\s*VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, false, \$8, \$9, \$10, \$11, \$12\)/g,
  "party_size, ticket_number, table_number, staff_id, business_date)\n        VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, $10, $11, $12, (SELECT DATE((CURRENT_TIMESTAMP AT TIME ZONE timezone) - rollover_time::interval) FROM restaurants WHERE id = $1))"
);

fs.writeFileSync('src/lib/db.ts', content);
console.log('Done!');
