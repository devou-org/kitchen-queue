const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/postgres' });
pool.query(`
  ALTER TABLE orders DROP COLUMN IF EXISTS staff_name;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staffs(id) ON DELETE SET NULL;
`).then(res => {
  console.log('Columns modified successfully');
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
