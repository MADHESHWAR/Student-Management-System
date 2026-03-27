// Mock LocalStorage Backend to simulate API for offline testing without Node.js

// Initialize Mock DB
function initMockDB() {
    if (!localStorage.getItem('db_admins')) {
        localStorage.setItem('db_admins', JSON.stringify([{ id: 1, username: 'admin', password: 'admin123', name: 'Super Admin' }]));
    }
    if (!localStorage.getItem('db_courses')) {
        localStorage.setItem('db_courses', JSON.stringify([
            { id: 1, course_code: 'CS101', course_name: 'Intro to Programming', department: 'Computer Science' }
        ]));
    }
    if (!localStorage.getItem('db_marks')) {
        localStorage.setItem('db_marks', JSON.stringify([
            { id: 1, student_id: 1, course_id: 1, marks: 85 }
        ]));
    }
}
initMockDB();

function getDB(table) { return JSON.parse(localStorage.getItem(`db_${table}`)) || []; }
function setDB(table, data) { localStorage.setItem(`db_${table}`, JSON.stringify(data)); }

// Overwrite window.fetch
const originalFetch = window.fetch;
window.fetch = async function (url, options) {
    if (url.startsWith('/api') || url.startsWith('http')) {
        // Strip API prefix just for our mock router
        const path = url.replace('/api', '').replace(window.location.origin, '');
        const method = (options && options.method) || 'GET';
        const body = options && options.body ? JSON.parse(options.body) : null;
        const authHeader = options && options.headers && options.headers['Authorization'];
        const token = authHeader ? authHeader.split(' ')[1] : null;

        const jsonRes = (status, data) => ({
            ok: status >= 200 && status < 300,
            status: status,
            json: async () => data
        });

        // Simulate network latency
        await new Promise(r => setTimeout(r, 200));

        try {
            // ADMIN LOGIN
            if (path.includes('/admin/login') && method === 'POST') {
                const admins = getDB('admins');
                const admin = admins.find(a => a.username === body.username && a.password === body.password);
                if (admin) {
                    return jsonRes(200, { token: 'mock-admin-' + admin.id, admin: { id: admin.id, name: admin.name, username: admin.username } });
                }
                return jsonRes(401, { message: 'Invalid credentials.' });
            }

            // STUDENT LOGIN
            if (path.includes('/student/login') && method === 'POST') {
                const students = getDB('students');
                const student = students.find(s => s.roll_number === body.roll_number && s.password === body.password);
                if (student) {
                    return jsonRes(200, { token: 'mock-student-' + student.id, student: { id: student.id, roll_number: student.roll_number, name: student.name } });
                }
                return jsonRes(401, { message: 'Invalid credentials. Default: 12345 / password' });
            }

            // Verify Auth
            let role = null;
            let userId = null;
            if (token && token.startsWith('mock-admin-')) {
                role = 'admin'; userId = parseInt(token.replace('mock-admin-', ''));
            } else if (token && token.startsWith('mock-student-')) {
                role = 'student'; userId = parseInt(token.replace('mock-student-', ''));
            }

            if (!role) return jsonRes(401, { message: 'Unauthorized access.' });

            // Admin Routes
            if (role === 'admin') {
                if (path.includes('/admin/stats') && method === 'GET') {
                    const students = getDB('students');
                    const courses = getDB('courses');
                    const depts = {};
                    students.forEach(s => { depts[s.department] = (depts[s.department] || 0) + 1; });
                    const deptArray = Object.keys(depts).map(d => ({ department: d, count: depts[d] }));
                    return jsonRes(200, { totalStudents: students.length, totalCourses: courses.length, departments: deptArray });
                }
                if (path.includes('/admin/students') && method === 'GET') {
                    return jsonRes(200, getDB('students').map(({ password, ...s }) => s));
                }
                if (path.includes('/admin/students') && method === 'POST') {
                    const students = getDB('students');
                    if (students.find(s => s.roll_number === body.roll_number)) return jsonRes(400, { message: 'Roll number exists.' });
                    const newId = students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1;
                    students.push({ id: newId, ...body });
                    setDB('students', students);
                    return jsonRes(201, { message: 'Student added!' });
                }
                if (path.includes('/admin/students/') && method === 'PUT') {
                    const sid = parseInt(path.split('/').pop());
                    const students = getDB('students');
                    const index = students.findIndex(s => s.id === sid);
                    if (index >= 0) {
                        students[index] = { ...students[index], ...body };
                        setDB('students', students);
                        return jsonRes(200, { message: 'Updated!' });
                    }
                    return jsonRes(404, { message: 'Not found' });
                }
                if (path.includes('/admin/students/') && method === 'DELETE') {
                    const sid = parseInt(path.split('/').pop());
                    let students = getDB('students').filter(s => s.id !== sid);
                    setDB('students', students);
                    return jsonRes(200, { message: 'Deleted!' });
                }
                if (path.includes('/admin/courses') && method === 'GET') {
                    return jsonRes(200, getDB('courses'));
                }
                if (path.includes('/admin/courses') && method === 'POST') {
                    const courses = getDB('courses');
                    const newId = courses.length > 0 ? Math.max(...courses.map(c => c.id)) + 1 : 1;
                    courses.push({ id: newId, ...body });
                    setDB('courses', courses);
                    return jsonRes(201, { message: 'Course added!' });
                }
                if (path.includes('/admin/marks') && method === 'POST') {
                    const marks = getDB('marks');
                    const index = marks.findIndex(m => m.student_id == body.student_id && m.course_id == body.course_id);
                    if (index >= 0) {
                        marks[index].marks = body.marks;
                    } else {
                        const newId = marks.length > 0 ? Math.max(...marks.map(m => m.id)) + 1 : 1;
                        marks.push({ id: newId, ...body });
                    }
                    setDB('marks', marks);
                    return jsonRes(200, { message: 'Marks updated!' });
                }
            }

            // Student Routes
            if (role === 'student') {
                if (path.includes('/student/profile') && method === 'GET') {
                    const student = getDB('students').find(s => s.id === userId);
                    if (!student) return jsonRes(404, { message: 'Not found.' });
                    const { password, ...profile } = student;
                    return jsonRes(200, profile);
                }
                if (path.includes('/student/profile') && method === 'PUT') {
                    const students = getDB('students');
                    const index = students.findIndex(s => s.id === userId);
                    if (index >= 0) {
                        students[index].email = body.email;
                        students[index].phone = body.phone;
                        setDB('students', students);
                        return jsonRes(200, { message: 'Profile updated!' });
                    }
                    return jsonRes(404, { message: 'Not found' });
                }
                if (path.includes('/student/marks') && method === 'GET') {
                    const marks = getDB('marks').filter(m => parseInt(m.student_id) === userId);
                    const courses = getDB('courses');
                    const records = marks.map(m => {
                        const course = courses.find(c => c.id == m.course_id) || {};
                        return { course_code: course.course_code || 'N/A', course_name: course.course_name || 'N/A', marks: m.marks };
                    });
                    return jsonRes(200, records);
                }
            }

            return jsonRes(404, { message: 'Not Found' });
        } catch (e) {
            return jsonRes(500, { message: e.message });
        }
    }

    return originalFetch(url, options);
};

// --- Original main.js Utilities Below ---

const API_URL = '/api';

async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    const response = await fetch(API_URL + url, {
        ...options,
        headers
    });

    if (response.status === 401 || response.status === 403) {
        handleLogout();
        throw new Error('Unauthorized');
    }

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed');
    }

    return data;
}

function checkAuth(requiredRole) {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    if (!token || !userRole) {
        window.location.href = 'index.html';
        return false;
    }

    if (requiredRole && userRole !== requiredRole) {
        window.location.href = userRole === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
        return false;
    }

    return true;
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userData');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    const userNameEl = document.getElementById('user-name-display');
    if (userNameEl) {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData.name) {
            userNameEl.textContent = userData.name;
        }
    }
});

function showAlert(elementId, message, type = 'error') {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = message;
    el.className = `alert alert-${type}`;
    el.style.display = 'block';

    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}
