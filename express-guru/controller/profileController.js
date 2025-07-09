const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const uploadprofile = require('../middleware/uploadProfile');
const JWT_SECRET = 'token-jwt';

// GET profile guru
const getProfileGuru = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [[guru]] = await db.query('SELECT * FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }
    res.status(200).json({ status: 200, data: guru });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil profil guru.' });
  }
};

// Update profile guru dengan upload foto
const updateProfileGuru = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil data lama
    const [[oldData]] = await db.query('SELECT * FROM guru WHERE user_id = ?', [userId]);
    if (!oldData) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    // Handle file upload jika ada
    let foto_profil = oldData.foto_profil;
    if (req.file) {
      // Hapus foto lama jika ada dan bukan foto default
      if (oldData.foto_profil && !oldData.foto_profil.includes('default')) {
        const oldFotoPath = path.join(__dirname, '../', oldData.foto_profil);
        if (fs.existsSync(oldFotoPath)) {
          fs.unlinkSync(oldFotoPath);
        }
      }
      // Simpan path foto baru
      foto_profil = '../express-admin/Upload/profile_image' + req.file.filename;
    }

    // Pakai data baru jika ada, jika tidak pakai data lama
    const {
      nama_guru = oldData.nama_guru,
      alamat = oldData.alamat,
      no_telepon = oldData.no_telepon,
      agama_guru = oldData.agama_guru,
      tempat_lahir_guru = oldData.tempat_lahir_guru,
      jenis_kelamin_guru = oldData.jenis_kelamin_guru,
      tanggal_lahir_guru = oldData.tanggal_lahir_guru
    } = req.body;

    await db.query(
      `UPDATE guru SET 
        nama_guru = ?, 
        alamat = ?, 
        no_telepon = ?, 
        agama_guru = ?, 
        tempat_lahir_guru = ?, 
        jenis_kelamin_guru = ?, 
        tanggal_lahir_guru = ?, 
        foto_profil = ?
      WHERE user_id = ?`,
      [
        nama_guru,
        alamat,
        no_telepon,
        agama_guru,
        tempat_lahir_guru,
        jenis_kelamin_guru,
        tanggal_lahir_guru,
        foto_profil,
        userId
      ]
    );

    res.status(200).json({ 
      status: 200, 
      message: 'Profil guru berhasil diperbarui.',
      foto_profil: foto_profil // Sertakan path foto baru dalam response
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal memperbarui profil guru.' });
  }
};

const updatePasswordGuru = async (req, res) => {
  const userId = req.user.userId;
  const { password_lama, password_baru, konfirmasi_password } = req.body;

  try {
    // 1. Validasi input
    if (!password_lama || !password_baru || !konfirmasi_password) {
      return res.status(400).json({ 
        status: 400,
        message: 'Password lama, baru, dan konfirmasi harus diisi' 
      });
    }

    if (password_baru.length < 6) {
      return res.status(400).json({ 
        status: 400,
        message: 'Password baru minimal 6 karakter' 
      });
    }

    if (password_baru !== konfirmasi_password) {
      return res.status(400).json({ 
        status: 400,
        message: 'Password baru dan konfirmasi tidak cocok' 
      });
    }

    // 2. Ambil data user dan guru
    const [[user]] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ 
        status: 404,
        message: 'User tidak ditemukan' 
      });
    }

    const [[guru]] = await db.query('SELECT * FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ 
        status: 404,
        message: 'Data guru tidak ditemukan' 
      });
    }

    // 3. Verifikasi password lama
    let passwordValid = false;
    
    // Case 1: Password is plaintext (stored in guru.token)
    if (guru.token && guru.token === password_lama) {
      passwordValid = true;
    }
    // Case 2: Password is hashed (bcrypt comparison)
    else if (user.password && (user.password.startsWith('$2b$') || user.password.startsWith('$2a$') || user.password.startsWith('$2y$'))) {
      passwordValid = await bcrypt.compare(password_lama, user.password);
    }

    if (!passwordValid) {
      return res.status(401).json({ 
        status: 401,
        message: 'Password lama tidak valid' 
      });
    }

    // 4. Hash password baru
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password_baru, salt);

    // 5. Update password di tabel user (hashed) dan guru (plaintext di token)
    await db.query('UPDATE user SET password = ? WHERE user_id = ?', [hashedPassword, userId]);
    await db.query('UPDATE guru SET token = ? WHERE user_id = ?', [password_baru, userId]);

    res.status(200).json({
      status: 200,
      message: 'Password berhasil diperbarui'
    });

  } catch (err) {
    console.error('Error updatePasswordGuru:', err);
    res.status(500).json({
      status: 500,
      message: 'Gagal memperbarui password',
      error: err.message
    });
  }
};

module.exports = { getProfileGuru, updateProfileGuru, updatePasswordGuru };