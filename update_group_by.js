const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'src/lib/db.ts');
let content = fs.readFileSync(dbPath, 'utf8');

// Replace GROUP BY o.id with GROUP BY o.id, s.name
content = content.replace(/GROUP BY o\.id\r?\n/g, "GROUP BY o.id, s.name\n");

// Replace GROUP BY o.id, ar.pos with GROUP BY o.id, ar.pos, s.name
content = content.replace(/GROUP BY o\.id, ar\.pos\r?\n/g, "GROUP BY o.id, ar.pos, s.name\n");

fs.writeFileSync(dbPath, content, 'utf8');
console.log('src/lib/db.ts GROUP BY clauses updated successfully.');
