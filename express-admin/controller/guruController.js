const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

// Helper untuk deteksi kata berbahaya
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Guru + User
const createGuru = async (req, res) => {
  const {
    nip, nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru,
    username, email, password
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Tambah ke tabel user
    const [result] = await db.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, 'guru']
    );

    // Ambil user_id yang baru saja dibuat
    const user_id = result.insertId;

    // 2. Tambah ke tabel guru
    await db.query(
      `INSERT INTO guru (nip, user_id, nama_guru, alamat, no_telepon, agama_guru, jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nip, user_id, nama_guru, alamat, no_telepon, agama_guru, jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru]
    );

    res.status(201).json({ message: 'Guru dan user berhasil ditambahkan' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan guru', error: error.message });
  }
};


// READ - Ambil Semua Guru
const getAllGuru = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT g.*, u.username, u.email FROM guru g JOIN user u ON g.user_id = u.user_id`);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data guru.' });
  }
};

// READ - Ambil Guru by NIP
const getGuruByNip = async (req, res) => {
  const { nip } = req.params;
  try {
    const [rows] = await db.query(`SELECT g.*, u.username, u.email FROM guru g JOIN user u ON g.user_id = u.user_id WHERE g.nip = ?`, [nip]);
    if (rows.length === 0) return res.status(404).json({ message: 'Guru tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data guru.' });
  }
};

// UPDATE - Edit Guru
const updateGuru = async (req, res) => {
  const { nip } = req.params;
  const {
    nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru
  } = req.body;

  try {
    const [result] = await db.query(`UPDATE guru SET 
      nama_guru = ?, alamat = ?, no_telepon = ?, agama_guru = ?, 
      jenis_kelamin_guru = ?, tanggal_lahir_guru = ?, tempat_lahir_guru = ?
      WHERE nip = ?`, 
      [nama_guru, alamat, no_telepon, agama_guru, jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru, nip]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Guru tidak ditemukan.' });
    res.json({ message: 'Guru berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui data guru.' });
  }
};

// DELETE - Hapus Guru dan User
const deleteGuru = async (req, res) => {
  const { nip } = req.params;

  try {
    const [rows] = await db.query(`SELECT user_id FROM guru WHERE nip = ?`, [nip]);
    if (rows.length === 0) return res.status(404).json({ message: 'Guru tidak ditemukan.' });

    const userId = rows[0].user_id;

    await db.query(`DELETE FROM guru WHERE nip = ?`, [nip]);
    await db.query(`DELETE FROM user WHERE user_id = ?`, [userId]);

    res.json({ message: 'Guru dan user berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus guru.' });
  }
};

module.exports = { createGuru,deleteGuru,getAllGuru,getGuruByNip,updateGuru };
