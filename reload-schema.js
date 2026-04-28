const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('Schema Reloaded!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}
run();
