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
  const plainPassword = generateRandomPassword();

  try {
    // Fungsi untuk generate BIGINT random yang unik
    const generateUniqueBigIntId = async () => {
      let isUnique = false;
      let newId;
      
      while (!isUnique) {
        // Generate 15-digit random number (BIGINT compatible)
        newId = BigInt(Math.floor(1e14 + Math.random() * 9e14)); // 100000000000000 - 999999999999999
        
        // Cek apakah ID sudah ada di database
        const [existing] = await db.query(
          'SELECT user_id FROM user WHERE user_id = ?', 
          [newId.toString()]
        );
        
        if (existing.length === 0) {
          isUnique = true;
        }
      }
      
      return newId;
    };

    // Generate user_id yang unik
    const user_id = await generateUniqueBigIntId();
    
    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Insert ke tabel user dengan user_id yang digenerate
    await db.query(
      'INSERT INTO user (user_id, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [user_id.toString(), username, email, hashedPassword, 'guru']
    );

    // Insert ke tabel guru
    await db.query(
      `INSERT INTO guru (nip, user_id, nama_guru, alamat, no_telepon, agama_guru, 
        jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru, foto_profil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nip, user_id.toString(), nama_guru, alamat, no_telepon, agama_guru, 
       jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru, foto_profile]
    );

    res.status(200).json({ 
      message: 'Guru berhasil ditambahkan',
      user_id: user_id.toString() // Mengembalikan user_id sebagai string untuk menghindari precision issues
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menambahkan guru', 
      error: error.message 
    });
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
  const { nip } = req.params; // NIP lama
  const {
    new_nip, // NIP baru (ditambahkan)
    nama_guru, alamat, no_telepon, agama_guru,
    jenis_kelamin_guru, tanggal_lahir_guru, tempat_lahir_guru,
    email
  } = req.body;

  const foto_profile = req.file ? req.file.filename : null;

  try {
    // 1. Ambil data lama
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

    // 2. Validasi jika new_nip sudah digunakan oleh guru lain
    if (new_nip && new_nip !== nip) {
      const [checkNip] = await db.query(
        `SELECT nip FROM guru WHERE nip = ? AND nip != ?`,
        [new_nip, nip]
      );
      if (checkNip.length > 0) {
        return res.status(400).json({ message: 'NIP sudah digunakan oleh guru lain.' });
      }
    }

    // 3. Perbarui tabel user (email)
    await db.query(
      `UPDATE user SET email = ? WHERE user_id = ?`,
      [email || oldData.email, oldData.user_id]
    );

    // 4. Perbarui tabel guru (termasuk NIP baru jika ada)
    await db.query(
      `UPDATE guru SET 
        nip = ?, 
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
        new_nip || nip, // Gunakan new_nip jika ada, jika tidak pakai nip lama
        nama_guru || oldData.nama_guru,
        alamat || oldData.alamat,
        no_telepon || oldData.no_telepon,
        agama_guru || oldData.agama_guru,
        jenis_kelamin_guru || oldData.jenis_kelamin_guru,
        tanggal_lahir_guru || oldData.tanggal_lahir_guru,
        tempat_lahir_guru || oldData.tempat_lahir_guru,
        foto_profile || oldData.foto_profil,
        nip // WHERE condition tetap pakai NIP lama
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
