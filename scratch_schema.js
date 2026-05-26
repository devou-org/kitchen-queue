const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function run() {
  try {
    const res = await sql`
        SELECT restaurant_id, possible_queue_status, priority 
        FROM queue_status 
        ORDER BY restaurant_id, priority ASC
    `;
    console.log(res);
  } catch (err) {
    console.error(err);
  }
}

run();
