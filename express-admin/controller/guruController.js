const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');


// Helper untuk deteksi kata berbahaya
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

// Helper untuk generate username dari nama_guru
const generateUsernameFromName = (name) => {
  const base = name.toLowerCase().replace(/[^a-z]/g, ''); // Hanya huruf a-z
  const randomNumber = Math.floor(100 + Math.random() * 900); // Tambah angka 100-999
  return base + randomNumber;
};


// CREATE - Tambah Guru + User
const createGuru = async (req, res) => {
  const {
    nip, nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru,
    email
  } = req.body;

  const username = generateUsernameFromName(nama_guru);


  const foto_profile = req.file ? req.file.filename : null;
  const plainPassword = generateRandomPassword(); // 6 karakter hex random

  try {

    const [result] = await db.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, plainPassword, 'guru']
    );

    const user_id = result.insertId;

    await db.query(
      `INSERT INTO guru (nip, user_id, nama_guru, alamat, no_telepon, agama_guru, jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru, foto_profil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nip, user_id, nama_guru, alamat, no_telepon, agama_guru, jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru, foto_profile]
    );

    res.status(200).json({ message: 'Guru berhasil ditambahkan'});
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
    const [rows] = await db.query(
      `SELECT g.*, u.username, u.email, 
              g.foto_profil AS foto_profil 
       FROM guru g 
       JOIN user u ON g.user_id = u.user_id 
       WHERE g.nip = ?`, 
      [nip]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Guru tidak ditemukan.' });

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data guru.' });
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

    res.json({ message: 'Guru berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus guru.' });
  }
};

// UPDATE - Perbarui data Guru
const updateGuru = async (req, res) => {
  const { nip } = req.params;
  const {
    nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru,
    email
  } = req.body;

  const foto_profile = req.file ? req.file.filename : null;

  try {
    // Ambil data lama
    const [existingRows] = await db.query(
      `SELECT g.*, u.email 
       FROM guru g 
       JOIN user u ON g.user_id = u.user_id 
       WHERE g.nip = ?`, 
      [nip]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ message: 'Guru tidak ditemukan.' });
    }

    const oldData = existingRows[0];

    // Perbarui tabel user (email saja)
    await db.query(
      `UPDATE user SET email = ? WHERE user_id = ?`,
      [email || oldData.email, oldData.user_id]
    );

    // Perbarui tabel guru
    await db.query(
      `UPDATE guru SET 
        nama_guru = ?, 
        alamat = ?, 
        no_telepon = ?, 
        agama_guru = ?, 
        jenis_kelamin_guru = ?, 
        tanggal_lahir_guru = ?, 
        tempat_lahir_guru = ?, 
        foto_profil = ?
      WHERE nip = ?`,
      [
        nama_guru || oldData.nama_guru,
        alamat || oldData.alamat,
        no_telepon || oldData.no_telepon,
        agama_guru || oldData.agama_guru,
        jenis_kelamin_guru || oldData.jenis_kelamin_guru,
        tanggal_lahir_guru || oldData.tanggal_lahir_guru,
        tempat_lahir_guru || oldData.tempat_lahir_guru,
        foto_profile || oldData.foto_profil,
        nip
      ]
    );

    res.json({ message: 'Data guru berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui data guru.' });
  }
};

module.exports = {
  createGuru,
  deleteGuru,
  getAllGuru,
  getGuruByNip,
  updateGuru // <- tambahkan ini
};


module.exports = { createGuru,deleteGuru,getAllGuru,getGuruByNip, updateGuru };
