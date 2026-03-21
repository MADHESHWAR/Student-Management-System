const jwt = require('jsonwebtoken');

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden. Admin access required.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token.' });
    }
};

const authenticateStudent = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'student') {
            return res.status(403).json({ message: 'Forbidden. Student access required.' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(400).json({ message: 'Invalid token.' });
    }
};

module.exports = { authenticateAdmin, authenticateStudent };
