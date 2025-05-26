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


module.exports = { verifyToken };
