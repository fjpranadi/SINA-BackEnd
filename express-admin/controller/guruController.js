const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const transporter = require('../config/emailConfig');


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

const getRekapAbsenGuru = async (req, res) => {
  const { tahun_akademik_id } = req.params;

  if (!tahun_akademik_id) {
      return res.status(400).json({ message: 'ID Tahun Akademik diperlukan.' });
  }

  try {
      // Memanggil stored procedure `sp_read_absen_guru` dengan parameter
      const [rows] = await db.query(
          'CALL sp_read_absen_guru(?)', 
          [tahun_akademik_id]
      );

      // Hasil dari stored procedure biasanya berada di indeks pertama dari array hasil
      res.status(200).json(rows[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Gagal mengambil data rekap absensi guru.' });
  }
};

// Fungsi untuk mengirim email login guru
const sendGuruLoginEmail = async (email, username, password, nip, namaGuru) => {
  const mailOptions = {
    from: `"SINA Sekolah" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Informasi Login Guru',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Informasi Akun Guru</h2>
        <p>Yth. Bapak/Ibu Guru <strong>${namaGuru}</strong>,</p>
        
        <p>Berikut adalah informasi login Anda untuk mengakses sistem SINA:</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <table style="width: 100%;">
            <tr>
              <td style="width: 120px;"><strong>NIP</strong></td>
              <td>${nip}</td>
            </tr>
            <tr>
              <td><strong>Nama</strong></td>
              <td>${namaGuru}</td>
            </tr>
            <tr>
              <td><strong>Username</strong></td>
              <td>${username}</td>
            </tr>
            <tr>
              <td><strong>Email</strong></td>
              <td>${email}</td>
            </tr>
            <tr>
              <td><strong>Password</strong></td>
              <td>${password}</td>
            </tr>
          </table>
        </div>
        
        <p style="margin-top: 20px;">
          <a href="${process.env.GURU_LOGIN_URL}" 
             style="background: #3498db; color: white; padding: 10px 15px; 
                    text-decoration: none; border-radius: 5px;">
            Login Sekarang
          </a>
        </p>
        
        <p style="font-size: 12px; color: #7f8c8d; margin-top: 30px;">
          Harap simpan informasi ini dengan aman dan jangan berikan kepada siapapun.
          <br>Untuk keamanan, disarankan untuk segera mengganti password setelah login pertama.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

// Kirim email ke semua guru
const sendEmailToAllGuru = async (req, res) => {
  try {
    // Ambil semua data guru
    const [gurus] = await db.query(
      `SELECT g.nip, g.nama_guru, g.token, u.email, u.username 
       FROM guru g
       JOIN user u ON g.user_id = u.user_id
       WHERE u.role = 'guru'`
    );

    // Kirim email ke setiap guru
    for (const guru of gurus) {
      // Jika token kosong, buat password baru
      if (!guru.token) {
        const newPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password di user dan token di guru
        await db.query('BEGIN');
        
        await db.query(
          'UPDATE user SET password = ? WHERE email = ?',
          [hashedPassword, guru.email]
        );
        
        await db.query(
          'UPDATE guru SET token = ? WHERE nip = ?',
          [newPassword, guru.nip]
        );
        
        await db.query('COMMIT');
        
        // Kirim email dengan password baru
        await sendGuruLoginEmail(guru.email, guru.username, newPassword, guru.nip, guru.nama_guru);
      } else {
        // Gunakan token yang sudah ada sebagai password plaintext
        await sendGuruLoginEmail(guru.email, guru.username, guru.token, guru.nip, guru.nama_guru);
      }
    }

    res.status(200).json({ 
      success: true,
      message: 'Email informasi login telah dikirim ke semua guru'
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error sendEmailToAllGuru:', error);
    res.status(500).json({ 
      success: false,
      message: 'Gagal mengirim email ke guru',
      error: error.message 
    });
  }
};

// Kirim email ke guru tertentu
const sendEmailToGuruByNip = async (req, res) => {
  const { nip } = req.params;

  try {
    // Ambil data guru
    const [guruRows] = await db.query(
      `SELECT g.nip, g.nama_guru, g.token, u.email, u.username 
       FROM guru g
       JOIN user u ON g.user_id = u.user_id
       WHERE g.nip = ? AND u.role = 'guru'`,
      [nip]
    );

    if (guruRows.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Guru tidak ditemukan' 
      });
    }

    const guru = guruRows[0];
    let passwordToSend = guru.token;

    // Jika token kosong, buat password baru
    if (!guru.token) {
      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password di user dan token di guru
      await db.query('BEGIN');
      
      await db.query(
        'UPDATE user SET password = ? WHERE email = ?',
        [hashedPassword, guru.email]
      );
      
      await db.query(
        'UPDATE guru SET token = ? WHERE nip = ?',
        [newPassword, guru.nip]
      );
      
      await db.query('COMMIT');
      
      passwordToSend = newPassword;
    }

    // Kirim email
    await sendGuruLoginEmail(guru.email, guru.username, passwordToSend, guru.nip, guru.nama_guru);

    res.status(200).json({ 
      success: true,
      message: 'Email informasi login telah dikirim',
      data: {
        nip: guru.nip,
        nama_guru: guru.nama_guru,
        email: guru.email
      }
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error sendEmailToGuruByNip:', error);
    res.status(500).json({ 
      success: false,
      message: 'Gagal mengirim email',
      error: error.message 
    });
  }
};

module.exports = {
  createGuru,
  deleteGuru,
  getAllGuru,
  getGuruByNip,
  updateGuru,
  getRekapAbsenGuru,
  sendEmailToAllGuru,
  sendEmailToGuruByNip
};
