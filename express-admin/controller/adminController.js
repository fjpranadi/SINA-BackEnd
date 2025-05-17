const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Helper: deteksi kata berbahaya (jaga-jaga)
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// Helper: password random 6 huruf
const generateRandomPassword = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let password = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters.charAt(randomIndex);
  }
  return password;
};

// Helper: buat nama file unik
const generateRandomFilename = (originalName) => {
  const ext = path.extname(originalName);
  const randomStr = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}_${randomStr}${ext}`;
};

// CREATE ADMIN
const createAdmin = async (req, res) => {
  const { username, email } = req.body;
  let foto_profile = null;

  // Random password
  const plainPassword = generateRandomPassword();

  // Handle upload foto dan rename filenya
  if (req.file) {
    const oldPath = req.file.path;
    foto_profile = generateRandomFilename(req.file.originalname);
    const newPath = path.join(path.dirname(oldPath), foto_profile);
    fs.renameSync(oldPath, newPath);
  }

  try {
    const [result] = await db.query(
      'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, plainPassword, 'admin']
    );

    const user_id = result.insertId;

    await db.query(
      `INSERT INTO admin (user_id, foto_profil, created_at) VALUES (?, ?, ?)`,
      [user_id, foto_profile, new Date()]
    );

    res.status(200).json({ message: 'Admin berhasil ditambahkan', password: plainPassword });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan admin', error: error.message });
  }
};

// GET ALL ADMIN
const getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.username, u.email FROM admin a JOIN user u ON a.user_id = u.user_id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data admin.' });
  }
};

// GET ADMIN BY ID
const getAdminbyuser = async (req, res) => {
  const { admin_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.username, u.email, a.foto_profil AS foto_profil 
       FROM admin a 
       JOIN user u ON a.user_id = u.user_id 
       WHERE a.admin_id = ?`,
      [admin_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan.' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data Admin.' });
  }
};

// DELETE ADMIN
const deleteAdmin = async (req, res) => {
  const admin_id = req.params.admin_id;

  try {
    // Ambil data admin dari database
    const [adminRows] = await db.query('SELECT foto_profil FROM admin WHERE admin_id = ?', [admin_id]);

    if (adminRows.length === 0) {
      return res.status(404).json({ message: 'Admin tidak ditemukan' });
    }

    const foto_profile = adminRows[0].foto_profile;

    // Hapus data admin dari database
    await db.query('DELETE FROM admin WHERE admin_id = ?', [admin_id]);

    // Hapus file gambar dari folder
    if (foto_profile) {
      const imagePath = path.join(__dirname, '../Upload/profile_image', foto_profile);

      fs.unlink(imagePath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.error('Gagal menghapus foto profil:', err);
        }
      });
    }

    res.status(200).json({ message: 'Admin berhasil dihapus' });
  } catch (error) {
    console.error('Error deleteAdmin:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus admin' });
  }
};

// EDIT ADMIN
const editAdmin = async (req, res) => {
  const { admin_id } = req.params;
  const { username, email } = req.body;
  const newFotoProfile = req.file?.filename || null;

  try {
    const [rows] = await db.query(
      `SELECT a.user_id, a.foto_profil, u.username AS oldUsername, u.email AS oldEmail
       FROM admin a
       JOIN user u ON a.user_id = u.user_id
       WHERE a.admin_id = ?`,
      [admin_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Admin tidak ditemukan.' });

    const { user_id, foto_profil: oldFoto, oldUsername, oldEmail } = rows[0];

    // Tentukan final value
    const finalUsername = (username && username.trim() !== '') ? username : oldUsername;
    const finalEmail = (email && email.trim() !== '') ? email : oldEmail;

    let finalFoto = oldFoto;

    if (req.file) {
      // Buat nama baru untuk file
      const uniqueFilename = generateRandomFilename(req.file.originalname);
      const oldPath = req.file.path;
      const newPath = path.join(path.dirname(oldPath), uniqueFilename);
      fs.renameSync(oldPath, newPath);
      finalFoto = uniqueFilename;

      // Hapus foto lama
      const oldImagePath = path.join(__dirname, '../Upload/profile_Image', oldFoto);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update user
    await db.query(`UPDATE user SET username = ?, email = ? WHERE user_id = ?`, [finalUsername, finalEmail, user_id]);

    // Update admin
    await db.query(`UPDATE admin SET foto_profil = ? WHERE admin_id = ?`, [finalFoto, admin_id]);

    res.json({ message: 'Admin berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui data Admin.' });
  }
};

module.exports = {
  createAdmin,
  getAdminbyuser,
  getAllAdmin,
  deleteAdmin,
  editAdmin
};
