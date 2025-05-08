const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project

// Helper buat cek kata-kata berbahaya
const containsSQLInjection = (input) => {
    const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
    const lowerInput = input.toLowerCase();
    return forbiddenWords.some(word => lowerInput.includes(word));
  };

  const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email dan Password wajib diisi!' });
    }

    if (containsSQLInjection(email) || containsSQLInjection(password)) {
        return res.status(400).json({ message: 'Input mengandung karakter berbahaya!' });
    }

    try {
        const [rows] = await db.query('CALL siswa_login_user(?)', [email]);

        const user = rows[0][0];

        if (!user) {
            return res.status(401).json({ message: 'Email tidak ditemukan!' });
        }

        if (password !== user.password) {
            return res.status(401).json({ message: 'Password salah!' });
        }

        if (user.role !== 'siswa') {
            return res.status(403).json({ message: 'Hanya siswa yang boleh login.' });
        }

        const token = jwt.sign(
            { userId: user.user_id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '5h' }
        );

        res.status(200).json({
            message: 'Login berhasil!',
            token: token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // ambil tokennya

    if (!token) {
        return res.status(401).json({ message: 'Token tidak ditemukan!' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // simpan data user di req.user
        next();
    } catch (error) {
        return res.status(403).json({ message: 'Token tidak valid!' });
    }
};


module.exports = { login, verifyToken };
