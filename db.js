const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  try {
    const client = await pool.connect();
    
    // 1. Create updated_at function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // 2. Create notes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         SERIAL PRIMARY KEY,
        title      VARCHAR(255) NOT NULL DEFAULT 'Untitled Note',
        content    TEXT NOT NULL DEFAULT '',
        tags       JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Create updated_at trigger (if not exists is tricky in PG, so we try/catch or just drop/create)
    await client.query(`
      DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
      CREATE TRIGGER update_notes_updated_at
      BEFORE UPDATE ON notes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // 4. Create versions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS note_versions (
        id       SERIAL PRIMARY KEY,
        note_id  INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        title    VARCHAR(255) NOT NULL,
        content  TEXT NOT NULL,
        saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Supabase (PostgreSQL) Database Initialized');
    client.release();
  } catch (error) {
    console.error('❌ Supabase Initialization Error:', error.message);
  }
}

initDB();

module.exports = pool;
