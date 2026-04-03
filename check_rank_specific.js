const { neon } = require('@neondatabase/serverless');
const url = "postgresql://neondb_owner:npg_kj6aVQi4DGRT@ep-young-voice-a1ih57cv-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(url);

const fs = require('fs');
async function check() {
  try {
    const rows = await sql`SELECT id, ticket_number, status, '--' || status || '--' as status_raw FROM orders WHERE ticket_number IN (33, 35)`;
    const ranking = await sql`
      SELECT id, ticket_number, ROW_NUMBER() OVER (ORDER BY ticket_number ASC) as pos 
      FROM orders 
      WHERE UPPER(status) IN ('PENDING', 'PREPARING', 'READY')
      ORDER BY ticket_number ASC
    `;
    const results = { rows, ranking: ranking.filter(r => [33, 35].includes(r.ticket_number)) };
    fs.writeFileSync('rank_results.json', JSON.stringify(results, null, 2));
    console.log('Results written to rank_results.json');
  } catch (err) {
    console.error(err);
  }
}
check();
