const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:SminLCa9cvGJgUc4rYjQYOfvQaHKdVDdJRMiCEtfbpvyLMfqamS9NvqU6ND6x3rf@51.79.161.180:5432/postgres' });
pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_name VARCHAR(255);").then(res => {
  console.log('Column added');
  pool.end();
}).catch(console.error);
