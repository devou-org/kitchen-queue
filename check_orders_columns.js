const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/postgres' });
pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'orders';
`).then(res => {
  console.log('Columns in orders table:', res.rows);
  pool.end();
}).catch(err => {
  console.error(err);
  pool.end();
});
