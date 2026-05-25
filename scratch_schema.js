const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function checkSchema() {
  const res = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'queue_state';
  `;
  console.log("queue_state cols:", res);
  
  const res2 = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'restaurants';
  `;
  console.log("restaurants cols:", res2.map(r => r.column_name).join(', '));
  process.exit();
}

checkSchema();
