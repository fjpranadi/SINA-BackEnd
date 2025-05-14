const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

// Helper untuk deteksi kata berbahaya
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};


// CREATE - Tambah Siswa + User
const tambahSiswa = async (req, res) => {
  const {
    username, email, password, nis, nisn, nama, tanggal, tempat,
    alamat, telepon, kelamin, agama, admin_id
  } = req.body;

  // Validasi input
  if (!username || !email || !password || !nis || !nisn || !nama || !tanggal || !tempat || !alamat || !telepon || !kelamin || !agama || !admin_id) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  if (!/^\d{12}$/.test(nis)) {
    return res.status(400).json({ message: 'NIS harus terdiri dari 12 digit angka.' });
  }

  if (nama.length > 50) {
    return res.status(400).json({ message: 'Nama maksimal 50 karakter.' });
  }

  const inputFields = [username, email, password, nis, nisn, nama, tempat, alamat];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Tambah ke tabel user
    const [userResult] = await db.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'siswa']
    );

    const user_id = userResult.insertId;

    // 2. Tambah ke tabel siswa
    await db.query(
      `INSERT INTO siswa (user_id, nis, nisn, nama, tanggal, tempat, alamat, telepon, kelamin, agama, admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, nis, nisn, nama, tanggal, tempat, alamat, telepon, kelamin, agama, admin_id]
    );

    res.status(201).json({ message: 'Siswa dan user berhasil ditambahkan.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan siswa.', error: error.message });
  }
};

// READ - Ambil Semua Siswa berdasarkan admin_id
const getAllSiswa = async (req, res) => {
  const { admin_id } = req.query;

  if (!admin_id) return res.status(400).json({ message: 'admin_id wajib diisi!' });

  try {
    const [rows] = await db.query(
      `SELECT s.*, u.username, u.email FROM siswa s JOIN user u ON s.user_id = u.user_id WHERE s.admin_id = ?`,
      [admin_id]
    );

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data siswa.' });
  }
};

// READ - Ambil Siswa by user_id
const getSiswaByUserId = async (req, res) => {
  const { user_id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT s.*, u.username, u.email FROM siswa s JOIN user u ON s.user_id = u.user_id WHERE s.user_id = ?`,
      [user_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan.' });

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data siswa.' });
  }
};

// UPDATE - Edit Siswa
const updateSiswa = async (req, res) => {
  const {
    user_id, username, email, password, nis, nisn, nama, tanggal, tempat,
    alamat, telepon, kelamin, agama, admin_id
  } = req.body;

  if (!user_id || !username || !email || !password || !nis || !nisn || !nama || !tanggal || !tempat || !alamat || !telepon || !kelamin || !agama || !admin_id) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  if (!/^\d{12}$/.test(nis)) {
    return res.status(400).json({ message: 'NIS harus terdiri dari 12 digit angka.' });
  }

  if (nama.length > 50) {
    return res.status(400).json({ message: 'Nama maksimal 50 karakter.' });
  }

  const inputFields = [username, email, password, nis, nisn, nama, tempat, alamat];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Update user
    await db.query(
      `UPDATE user SET username = ?, email = ?, password = ? WHERE user_id = ?`,
      [username, email, hashedPassword, user_id]
    );

    // 2. Update siswa
    const [result] = await db.query(
      `UPDATE siswa SET nis = ?, nisn = ?, nama = ?, tanggal = ?, tempat = ?, alamat = ?, telepon = ?, kelamin = ?, agama = ?, admin_id = ? 
       WHERE user_id = ?`,
      [nis, nisn, nama, tanggal, tempat, alamat, telepon, kelamin, agama, admin_id, user_id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan.' });

    res.status(200).json({ message: 'Data siswa berhasil diperbarui.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui data siswa.', error: err.message });
  }
};

// DELETE - Hapus Siswa dan User
const hapusSiswa = async (req, res) => {
  const { user_id } = req.params;

  try {
    const [rows] = await db.query(`SELECT user_id FROM siswa WHERE user_id = ?`, [user_id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Siswa tidak ditemukan.' });

    await db.query(`DELETE FROM siswa WHERE user_id = ?`, [user_id]);
    await db.query(`DELETE FROM user WHERE user_id = ?`, [user_id]);

    res.status(200).json({ message: 'Siswa dan user berhasil dihapus.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus siswa.', error: err.message });
  }
};

module.exports = {
  tambahSiswa,
  getAllSiswa,
  getSiswaByUserId,
  updateSiswa,
  hapusSiswa
};
