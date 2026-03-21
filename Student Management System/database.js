const { Pool } = require('pg');
require('dotenv').config();

// If deploying to Render etc., rely on DATABASE_URL. Otherwise fallback to local configs.
const poolConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Render requires SSL for external connections
  max: 10,
  idleTimeoutMillis: 30000
} : {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_management',
  port: process.env.DB_PORT || 5432,
  max: 10,
  idleTimeoutMillis: 30000
};

const pool = new Pool(poolConfig);

async function initDB() {
  try {
    const client = await pool.connect();

    // Create Admins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL
      )
    `);

    // Create Students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        roll_number VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        department VARCHAR(100),
        year INT,
        email VARCHAR(100),
        phone VARCHAR(20)
      )
    `);

    // Create Courses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        course_code VARCHAR(20) NOT NULL UNIQUE,
        course_name VARCHAR(100) NOT NULL,
        department VARCHAR(100) NOT NULL
      )
    `);

    // Create Marks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS marks (
        id SERIAL PRIMARY KEY,
        student_id INT,
        course_id INT,
        marks INT,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
      )
    `);

    // Add default admin if not exists (username: admin, password: admin123)
    const { rows: adminRows } = await client.query('SELECT * FROM admins WHERE username = $1', ['admin']);
    if (adminRows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await client.query('INSERT INTO admins (username, password, name) VALUES ($1, $2, $3)', ['admin', hash, 'Super Admin']);
      console.log('Default admin created: admin / admin123');
    }

    client.release();
    console.log('Database initialized successfully.');
  } catch (error) {
    if (error.code === '3D000') {
      console.error(`Database '${process.env.DB_NAME}' does not exist. Please create it first.`);
    } else {
      console.error('Database connection failed:', error.message);
    }
  }
}

module.exports = { pool, initDB };
