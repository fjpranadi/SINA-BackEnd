const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ObjectId } = require('bson');
const nodemailer = require('nodemailer');
const transporter = require('../config/emailConfig');

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
    // Fungsi untuk generate user_id unik (BigInt 15 digit)
    const generateUniqueId = async (table, column) => {
      let unique = false;
      let id;

      while (!unique) {
        id = BigInt('' + Math.floor(1e14 + Math.random() * 9e14)); // 15 digit BigInt
        const [check] = await db.query(
          `SELECT ${column} FROM ${table} WHERE ${column} = ?`,
          [id]
        );
        if (check.length === 0) {
          unique = true;
        }
      }

      return id;
    };

    const user_id = await generateUniqueId('user', 'user_id');
    const admin_id = await generateUniqueId('admin', 'admin_id');

    // Hash password sebelum disimpan
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await db.query(
      'INSERT INTO user (user_id, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [user_id, username, email, hashedPassword, 'admin']
    );

    await db.query(
      `INSERT INTO admin (admin_id, user_id, foto_profil, created_at) VALUES (?, ?, ?, ?)`,
      [admin_id, user_id, foto_profile, new Date()]
    );

    res.status(200).json({ 
      message: 'Admin berhasil ditambahkan', 
      password: plainPassword, // Kirim password plain hanya sekali ke admin
      admin_id: admin_id.toString() 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan admin', error: error.message });
  }
};

// GET ALL ADMIN
const getAllAdmin = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT a.*, u.username, u.email
       FROM admin a
       JOIN user u ON a.user_id = u.user_id
       WHERE u.role = 'admin'`
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

const sendAdminLoginEmail = async (email, username, password) => {
  const mailOptions = {
    from: `"SINA Admin" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Informasi Login Admin',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Informasi Login Admin</h2>
        <p>Berikut adalah informasi login Anda untuk mengakses sistem admin:</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.ADMIN_LOGIN_URL}" 
             style="background: #3498db; color: white; padding: 10px 15px; 
                    text-decoration: none; border-radius: 5px;">
            Login Sekarang
          </a>
        </p>
        
        <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
          Harap simpan informasi ini dengan aman dan jangan berikan kepada siapapun.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Kirim email ke semua admin
const sendEmailToAllAdmins = async (req, res) => {
  try {
    // Ambil semua data admin
    const [admins] = await db.query(
      `SELECT a.admin_id, a.token, u.email, u.username 
       FROM admin a
       JOIN user u ON a.user_id = u.user_id
       WHERE u.role = 'admin'`
    );

    // Kirim email ke setiap admin
    for (const admin of admins) {
      // Jika token kosong, buat password baru
      if (!admin.token) {
        const newPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password di user dan token di admin
        await db.query('BEGIN');
        
        await db.query(
          'UPDATE user SET password = ? WHERE email = ?',
          [hashedPassword, admin.email]
        );
        
        await db.query(
          'UPDATE admin SET token = ? WHERE admin_id = ?',
          [newPassword, admin.admin_id]
        );
        
        await db.query('COMMIT');
        
        // Kirim email dengan password baru
        await sendAdminLoginEmail(admin.email, admin.username, newPassword);
      } else {
        // Gunakan token yang sudah ada sebagai password plaintext
        await sendAdminLoginEmail(admin.email, admin.username, admin.token);
      }
    }

    res.status(200).json({ 
      success: true,
      message: 'Email informasi login telah dikirim ke semua admin'
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error sendEmailToAllAdmins:', error);
    res.status(500).json({ 
      success: false,
      message: 'Gagal mengirim email ke admin',
      error: error.message 
    });
  }
};

// Kirim email ke admin tertentu
const sendEmailToAdminById = async (req, res) => {
  const { admin_id } = req.params;

  try {
    // Ambil data admin
    const [adminRows] = await db.query(
      `SELECT a.admin_id, a.token, u.email, u.username 
       FROM admin a
       JOIN user u ON a.user_id = u.user_id
       WHERE a.admin_id = ? AND u.role = 'admin'`,
      [admin_id]
    );

    if (adminRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin tidak ditemukan' 
      });
    }

    const admin = adminRows[0];
    let passwordToSend = admin.token;

    // Jika token kosong, buat password baru
    if (!admin.token) {
      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password di user dan token di admin
      await db.query('BEGIN');
      
      await db.query(
        'UPDATE user SET password = ? WHERE email = ?',
        [hashedPassword, admin.email]
      );
      
      await db.query(
        'UPDATE admin SET token = ? WHERE admin_id = ?',
        [newPassword, admin.admin_id]
      );
      
      await db.query('COMMIT');
      
      passwordToSend = newPassword;
    }

    // Kirim email
    await sendAdminLoginEmail(admin.email, admin.username, passwordToSend);

    res.status(200).json({ 
      success: true,
      message: 'Email informasi login telah dikirim',
      data: {
        admin_id: admin.admin_id,
        email: admin.email
      }
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error sendEmailToAdminById:', error);
    res.status(500).json({ 
      success: false,
      message: 'Gagal mengirim email',
      error: error.message 
    });
  }
};

module.exports = {
  createAdmin,
  getAdminbyuser,
  getAllAdmin,
  deleteAdmin,
  editAdmin,
  sendEmailToAllAdmins,
  sendEmailToAdminById
};
