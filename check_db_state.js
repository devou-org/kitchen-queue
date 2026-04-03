const { neon } = require('@neondatabase/serverless');

const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

async function checkTasks() {
  try {
    const rows = await sql`
      WITH active_ranks AS (
         SELECT id, ticket_number, status, ROW_NUMBER() OVER (ORDER BY ticket_number ASC) as pos
         FROM orders
         WHERE UPPER(status) IN ('PENDING', 'PREPARING', 'READY')
      )
      SELECT * FROM active_ranks ORDER BY ticket_number ASC;
    `;
    console.log('Active Orders and their ranks:');
    console.log(JSON.stringify(rows, null, 2));

    const allOrders = await sql`SELECT id, ticket_number, status, phone FROM orders ORDER BY ticket_number DESC LIMIT 10`;
    console.log('\nLast 10 orders:');
    console.log(JSON.stringify(allOrders, null, 2));

  } catch (err) {
    console.error('Check failed:', err);
  }
}

checkTasks();
