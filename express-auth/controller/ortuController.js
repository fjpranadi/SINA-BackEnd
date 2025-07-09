const db = require('../database/db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transporter = require('../config/emailConfig');

// Helper untuk validasi input
const validateInput = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create'];
  const lowerInput = input.toLowerCase();
  return !forbiddenWords.some(word => lowerInput.includes(word));
};

const registerOrtu = async (req, res) => {
  const { nis, status_ortu } = req.body;

  // Validasi input
  if (!nis || !status_ortu) {
    return res.status(400).json({ 
      success: false,
      message: 'NIS dan status ortu wajib diisi!' 
    });
  }

  if (!validateInput(nis) || !validateInput(status_ortu)) {
    return res.status(400).json({
      success: false,
      message: 'Input mengandung karakter yang tidak diperbolehkan'
    });
  }

  try {
    // 1. Cek data siswa dan ortu yang sudah terdaftar
    const [result] = await db.query(`
      SELECT 
        s.nis, s.nama_siswa,
        o.nik, o.nama_ortu, o.status_ortu, o.token, o.imei,
        o.no_telepon, o.alamat, o.foto_profil,
        u.user_id, u.email, u.username, u.role
      FROM siswa s
      JOIN siswa_ortu so ON s.nis = so.nis
      JOIN ortu o ON so.nik = o.nik
      JOIN user u ON o.user_id = u.user_id
      WHERE s.nis = ? AND o.status_ortu = ?
    `, [nis, status_ortu]);

    if (result.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: `Data ${status_ortu} untuk siswa dengan NIS ${nis} tidak ditemukan` 
      });
    }

    const data = result[0];
    
    // 2. Cek apakah sudah terdaftar (token sudah ada)
    if (data.token) {
      return res.status(400).json({
        success: false,
        message: `Anda sudah terdaftar sebagai ${status_ortu} untuk siswa ini`
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'Silakan masukkan OTP yang diberikan admin untuk melanjutkan registrasi',
      data: {
        nis: data.nis,
        nama_siswa: data.nama_siswa,
        status_ortu: data.status_ortu,
        email_ortu: data.email,
        nama_ortu: data.nama_ortu
      }
    });

  } catch (error) {
    console.error('Error registrasi ortu:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

const verifyOtp = async (req, res) => {
  const { nis, status_ortu, otp, email } = req.body;

  // Validasi input
  if (!nis || !status_ortu || !otp || !email) {
    return res.status(400).json({ 
      success: false,
      message: 'Semua field wajib diisi!' 
    });
  }

  try {
    // 1. Verifikasi OTP dengan timezone WITA (UTC+8)
    await db.query("SET time_zone = '+08:00'");
    
    const [otpRows] = await db.query(
      `SELECT * FROM otp_storage 
       WHERE email = ? 
       AND otp = ? 
       AND expires_at > NOW()`,
      [email, otp]
    );

    if (otpRows.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'OTP tidak valid atau sudah kadaluarsa' 
      });
    }

    // 2. Cek data ortu
    const [ortuData] = await db.query(`
      SELECT 
        o.nik, o.nama_ortu, o.status_ortu,
        u.user_id, u.email as user_email
      FROM ortu o
      JOIN user u ON o.user_id = u.user_id
      JOIN siswa_ortu so ON o.nik = so.nik
      WHERE so.nis = ? AND o.status_ortu = ? AND u.email = ?
    `, [nis, status_ortu, email]);

    if (ortuData.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Data ortu tidak ditemukan' 
      });
    }

    const ortu = ortuData[0];

    // 3. Generate JWT token untuk registrasi
    const registrationToken = jwt.sign(
      {
        user_id: ortu.user_id,
        nik: ortu.nik,
        email: ortu.user_email,
        nis: nis,
        status_ortu: status_ortu
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' } // Token hanya valid 15 menit
    );

    res.status(200).json({ 
      success: true,
      message: 'OTP berhasil diverifikasi. Silakan lanjutkan registrasi',
      registration_token: registrationToken
    });

  } catch (error) {
    console.error('Error verifikasi OTP:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

const completeRegistration = async (req, res) => {
  const { password, confirm_password, imei, registration_token } = req.body;

  // Validasi input
  if (!password || !confirm_password || !imei || !registration_token) {
    return res.status(400).json({ 
      success: false,
      message: 'Semua field wajib diisi!' 
    });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ 
      success: false,
      message: 'Password dan konfirmasi password tidak sama' 
    });
  }

  try {
    // 1. Verifikasi registration token
    const decoded = jwt.verify(registration_token, process.env.JWT_SECRET);
    
    const { user_id, nik, email, nis, status_ortu, nama_ortu } = decoded;

    // 2. Cek apakah ortu sudah terdaftar (token sudah ada)
    const [ortuData] = await db.query(
      'SELECT token FROM ortu WHERE nik = ?',
      [nik]
    );

    if (ortuData.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Data ortu tidak ditemukan' 
      });
    }

    if (ortuData[0].token) {
      return res.status(400).json({
        success: false,
        message: `Anda sudah terdaftar sebagai ${status_ortu} untuk siswa ini`
      });
    }

    // 3. Hash password baru untuk disimpan di tabel user
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Update password di tabel user (hash) dan simpan password plaintext di tabel ortu
    await db.query('BEGIN');

    await db.query(
      'UPDATE user SET password = ? WHERE user_id = ?',
      [hashedPassword, user_id]
    );

    await db.query(
      'UPDATE ortu SET token = ?, imei = ? WHERE nik = ?',
      [password, imei, nik]
    );

    await db.query('COMMIT');

    // 5. Kirim email konfirmasi DENGAN PLAINTEXT PASSWORD
    const mailOptions = {
      from: `"SINA" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Registrasi Akun Orang Tua Berhasil',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Registrasi Berhasil!</h2>
          <p>Halo ${nama_ortu},</p>
          <p>Anda telah terdaftar sebagai ${status_ortu} dari siswa dengan NIS ${nis}.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #2c3e50;">Detail Login Anda:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> <span style="font-weight: bold; color: #e74c3c;">${password}</span></p>
            <p><strong>Status:</strong> ${status_ortu}</p>
          </div>
          <p style="color: #7f8c8d; font-size: 0.9em;">
            <strong>Note:</strong> Simpan informasi login ini dengan aman. Jangan bagikan password Anda kepada siapapun.
          </p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/login" 
               style="background: #3498db; color: white; padding: 10px 15px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Login Sekarang
            </a>
          </p>
          <p style="color: #7f8c8d; font-size: 0.8em; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
            Email ini dikirim otomatis. Mohon tidak membalas email ini.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true,
      message: 'Registrasi berhasil! Silakan login dengan email dan password Anda',
      data: {
        user_id: user_id,
        email: email,
        status_ortu: status_ortu,
        imei: imei
      }
    });

  } catch (error) {
    await db.query('ROLLBACK');
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ 
        success: false,
        message: 'Token registrasi tidak valid atau sudah kadaluarsa' 
      });
    }
    
    console.error('Error complete registration:', error);
    res.status(500).json({ 
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

module.exports = { 
  registerOrtu, 
  verifyOtp,
  completeRegistration 
};