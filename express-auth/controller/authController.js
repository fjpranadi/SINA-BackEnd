const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
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
        const [rows] = await db.query('CALL login_user(?)', [email]);
        const user = rows[0][0];

        if (!user) {
            return res.status(400).json({ message: 'Email atau Password tidak sama!' });
        }

        // Check both plaintext and hashed password
        let passwordValid = false;
        
        // Case 1: Password matches plaintext (direct comparison)
        if (password === user.password) {
            passwordValid = true;
        } 
        // Case 2: Password is hashed (bcrypt comparison)
        else if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$')) {
            passwordValid = await bcrypt.compare(password, user.password);
        }

        if (!passwordValid) {
            return res.status(400).json({ message: 'Email atau Password tidak sama!' });
        }

        const allowedRoles = ['siswa', 'ortu', 'guru'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: 'Role tidak dikenali atau tidak diizinkan login.' });
        }

        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role,
                username: user.username
            },
            JWT_SECRET,
            { expiresIn: '5h' }
        );

        res.status(200).json({
            message: 'Login berhasil!',
            token: token,
            data: {
                userId: user.user_id,
                email: user.email,
                username: user.username,
                role: user.role,
                foto_profil: user.foto_profil
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { login };