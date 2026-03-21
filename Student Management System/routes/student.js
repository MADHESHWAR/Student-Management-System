const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');
const { authenticateStudent } = require('../middleware/auth');

// Student Login
router.post('/login', async (req, res) => {
    const { roll_number, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT * FROM students WHERE roll_number = $1', [roll_number]);
        if (rows.length === 0) return res.status(401).json({ message: 'Invalid roll number or password.' });

        const student = rows[0];
        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid roll number or password.' });

        const token = jwt.sign({ id: student.id, role: 'student' }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ 
            token, 
            student: { 
                id: student.id, 
                roll_number: student.roll_number, 
                name: student.name 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Profile
router.get('/profile', authenticateStudent, async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT id, roll_number, name, department, year, email, phone FROM students WHERE id = $1', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Student not found.' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile (Limited Fields: Email, Phone)
router.put('/profile', authenticateStudent, async (req, res) => {
    const { email, phone } = req.body;
    try {
        await pool.query('UPDATE students SET email = $1, phone = $2 WHERE id = $3', [email, phone, req.user.id]);
        res.json({ message: 'Profile updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Academic Details & Marks
router.get('/marks', authenticateStudent, async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT c.course_code, c.course_name, m.marks 
            FROM marks m 
            JOIN courses c ON m.course_id = c.id 
            WHERE m.student_id = $1
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
