import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkHolidays() {
  const res = await pool.query(`SELECT * FROM holidays WHERE holiday_date >= '2026-08-24' AND holiday_date <= '2026-08-26'`);
  console.log('Holidays in DB:', res.rows);

  // Insert/Upsert 'First Onam / Milad-i-Sherif' for 2026-08-25
  await pool.query(
    `INSERT INTO holidays (name, holiday_date, holiday_type, is_public_holiday, country_code, state_code, source)
     VALUES ('First Onam / Milad-i-Sherif', '2026-08-25', 'STATE_PUBLIC', true, 'IN', 'KL', 'Kerala Government')
     ON CONFLICT DO NOTHING`
  );
  console.log('Upserted First Onam / Milad-i-Sherif for 2026-08-25');
  process.exit(0);
}

checkHolidays().catch(e => { console.error(e); process.exit(1); });
