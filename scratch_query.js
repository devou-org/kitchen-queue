require('dotenv').config({path: '.env.local'});
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
      SELECT q.*, qs.possible_queue_status as queue_status, u.name as user_name, u.phone as user_phone,
             (REPLACE(q.created_at::text, ' ', 'T') || 'Z') as created_at
      FROM queues q
      JOIN queue_status qs ON q.queue_status_id = qs.id
      JOIN users u ON q.user_id = u.id
      WHERE q.restaurant_id = $1 
        AND q.business_date = DATE((CURRENT_TIMESTAMP AT TIME ZONE (SELECT timezone FROM restaurants WHERE id = q.restaurant_id)) - (SELECT rollover_time FROM restaurants WHERE id = q.restaurant_id)::interval)
      ORDER BY q.token_number ASC
`, ['1cb1d3e9-4d2f-44b6-b27a-dadabe29a2a5'])
  .then(res => { console.log("Rows count:", res.rows.length); console.log(JSON.stringify(res.rows, null, 2)); pool.end(); })
  .catch(console.error);
