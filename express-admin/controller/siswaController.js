const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// Helper untuk deteksi kata berbahayaa
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

const generateRandomPassword = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // Hanya huruf besar dan kecil
  let password = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters.charAt(randomIndex);
  }
  return password;
};


// CREATE - Tambah Siswa + User
const tambahSiswa = async (req, res) => {
  const {
    username, email,
    nis, nisn, nama_siswa, tanggal_lahir,
    alamat, no_telepon, jenis_kelamin, agama, admin_id
  } = req.body;

  const foto_profil = req.file ? req.file.filename : null;
  const plainPassword = generateRandomPassword();

  if (!username || !email || !nis || !nisn || !nama_siswa || !tanggal_lahir ||
      !alamat || !no_telepon || !jenis_kelamin || !agama || !admin_id) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Format email tidak valid.' });
  }

  if (!/^\d{12}$/.test(nis)) {
    return res.status(400).json({ message: 'NIS harus terdiri dari 12 digit angka.' });
  }

  if (nama_siswa.length > 50) {
    return res.status(400).json({ message: 'Nama maksimal 50 karakter.' });
  }

  const inputFields = [username, email, plainPassword, nis, nisn, nama_siswa, alamat];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    const [existing] = await db.query(
      'SELECT * FROM user WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username atau email sudah terdaftar.' });
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const [userResult] = await db.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'siswa']
    );

    const user_id = userResult.insertId;

    await db.query(
      `INSERT INTO siswa (user_id, nis, nisn, nama_siswa, tanggal_lahir, alamat, no_telepon, jenis_kelamin, agama, foto_profil, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [user_id, nis, nisn, nama_siswa, tanggal_lahir, alamat, no_telepon, jenis_kelamin, agama, foto_profil || null]
    );

    res.status(201).json({ 
      message: 'Siswa dan user berhasil ditambahkan.',
      username,
      email,
      password: plainPassword // Hanya jika kamu ingin menampilkan/mengirim password ke admin
    });

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

// UPDATE - Edit
const updateSiswa = async (req, res) => {
  const { nis, nisn, nama_siswa, tanggal_lahir, alamat, no_telepon, jenis_kelamin, agama } = req.body;
  const { user_id } = req.params;

  if (!nis || !nisn || !nama_siswa || !tanggal_lahir || !alamat || !no_telepon || !jenis_kelamin || !agama) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    await db.query(
      `UPDATE siswa SET nis=?, nisn=?, nama_siswa=?, tanggal_lahir=?, alamat=?, no_telepon=?, jenis_kelamin=?, agama=? WHERE user_id=?`,
      [nis, nisn, nama_siswa, tanggal_lahir, alamat, no_telepon, jenis_kelamin, agama, user_id]
    );

    res.status(200).json({ message: 'Data siswa berhasil diupdate.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui data siswa.', error: error.message });
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
