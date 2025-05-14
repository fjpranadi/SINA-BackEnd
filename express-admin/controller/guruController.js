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

// CREATE - Tambah Guru + User
const createGuru = async (req, res) => {
  const {
    nip, nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru,
    username, email
  } = req.body;

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

    res.status(200).json({ message: 'Guru berhasil ditambahkan', password: plainPassword });
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
              CONCAT('http://sina.pnb.ac.id:3000/Upload/profile_image/', g.foto_profil) AS foto_profil 
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


// UPDATE - Edit Guru
const updateGuru = async (req, res) => {
  const { nip } = req.params;
  const {
    nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru
  } = req.body;

  const foto_profile = req.file ? req.file.filename : null;

  try {
    const fields = [
      nama_guru, alamat, no_telepon, agama_guru,
      jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru
    ];
    let sql = `UPDATE guru SET 
      nama_guru = ?, alamat = ?, no_telepon = ?, agama_guru = ?, 
      jenis_kelamin_guru = ?, tanggal_lahir_guru = ?, tempat_lahir_guru = ?`;

    if (foto_profile) {
      sql += `, foto_profile = ?`;
      fields.push(foto_profile);
    }

    sql += ` WHERE nip = ?`;
    fields.push(nip);

    const [result] = await db.query(sql, fields);

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

    res.json({ message: 'Guru berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus guru.' });
  }
};

module.exports = { createGuru,deleteGuru,getAllGuru,getGuruByNip,updateGuru };
