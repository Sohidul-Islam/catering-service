import { db } from './index';
import { sql } from 'drizzle-orm';

async function testConnection() {
  console.log('Testing database connection...');
  try {
    const result = await db.execute(sql`SELECT 1 as connection_test`);
    console.log('Database connection successful!');
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
