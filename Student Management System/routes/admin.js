const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');
const { authenticateAdmin } = require('../middleware/auth');

// Admin Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid credentials.' });

        const admin = rows[0];
        
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

        const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, admin: { id: admin.id, name: admin.name, username: admin.username } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
    try {
        const { rows: studentCount } = await pool.query('SELECT COUNT(*) as total FROM students');
        const { rows: courseCount } = await pool.query('SELECT COUNT(*) as total FROM courses');
        const { rows: deptCount } = await pool.query('SELECT department, COUNT(*) as count FROM students GROUP BY department');

        res.json({
            totalStudents: parseInt(studentCount[0].total),
            totalCourses: parseInt(courseCount[0].total),
            departments: deptCount
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Students Management ---

// Get all students
router.get('/students', authenticateAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, roll_number, name, department, year, email, phone FROM students');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add new student
router.post('/students', authenticateAdmin, async (req, res) => {
    const { roll_number, password, name, department, year, email, phone } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO students (roll_number, password, name, department, year, email, phone) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [roll_number, hash, name, department, year, email, phone]
        );
        res.status(201).json({ id: rows[0].id, message: 'Student added successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Roll number already exists.' });
        res.status(500).json({ error: err.message });
    }
});

// Update student
router.put('/students/:id', authenticateAdmin, async (req, res) => {
    const { name, department, year, email, phone } = req.body;
    try {
        await pool.query(
            'UPDATE students SET name = $1, department = $2, year = $3, email = $4, phone = $5 WHERE id = $6',
            [name, department, year, email, phone, req.params.id]
        );
        res.json({ message: 'Student updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete student
router.delete('/students/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
        res.json({ message: 'Student deleted successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Courses Management ---

// Get all courses
router.get('/courses', authenticateAdmin, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM courses');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add course
router.post('/courses', authenticateAdmin, async (req, res) => {
    const { course_code, course_name, department } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO courses (course_code, course_name, department) VALUES ($1, $2, $3) RETURNING id',
            [course_code, course_name, department]
        );
        res.status(201).json({ id: rows[0].id, message: 'Course added successfully.' });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ message: 'Course code already exists.' });
        res.status(500).json({ error: err.message });
    }
});

// Assign Marks
router.post('/marks', authenticateAdmin, async (req, res) => {
    const { student_id, course_id, marks } = req.body;
    try {
        // Check if marks exist
        const { rows: existing } = await pool.query('SELECT * FROM marks WHERE student_id = $1 AND course_id = $2', [student_id, course_id]);
        if (existing.length > 0) {
            await pool.query('UPDATE marks SET marks = $1 WHERE student_id = $2 AND course_id = $3', [marks, student_id, course_id]);
        } else {
            await pool.query('INSERT INTO marks (student_id, course_id, marks) VALUES ($1, $2, $3)', [student_id, course_id, marks]);
        }
        res.json({ message: 'Marks updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
