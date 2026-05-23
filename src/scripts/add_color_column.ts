import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  try {
    await sql`ALTER TABLE queue_status ADD COLUMN color VARCHAR(20) DEFAULT '#cbd5e1'`;
    console.log('Added color column to queue_status table');
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('Column already exists');
    } else {
      console.error(err);
    }
  }
}
run();
