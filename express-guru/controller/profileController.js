const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
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

const updateProfileGuru = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil data lama
    const [[oldData]] = await db.query('SELECT * FROM guru WHERE user_id = ?', [userId]);
    if (!oldData) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    // Pakai data baru jika ada, jika tidak pakai data lama
    const {
      nama_guru = oldData.nama_guru,
      alamat = oldData.alamat,
      no_telepon = oldData.no_telepon,
      agama_guru = oldData.agama_guru,
      tempat_lahir_guru = oldData.tempat_lahir_guru,
      jenis_kelamin_guru = oldData.jenis_kelamin_guru,
      tanggal_lahir_guru = oldData.tanggal_lahir_guru,
      foto_profil = oldData.foto_profil
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

    res.status(200).json({ status: 200, message: 'Profil guru berhasil diperbarui.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal memperbarui profil guru.' });
  }
};

const updatePasswordGuru = async (req, res) => {
  const userId = req.user.userId;
  const { password_lama, password_baru, konfirmasi_password } = req.body;

  try {
    // Validasi input
    if (!password_lama || !password_baru || !konfirmasi_password) {
      return res.status(400).json({ message: 'Semua field harus diisi.' });
    }

    if (password_baru !== konfirmasi_password) {
      return res.status(400).json({ message: 'Password baru dan konfirmasi tidak cocok.' });
    }

    // Ambil data user dari tabel login (bukan dari guru)
    const [[user]] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }

    // Cek password lama
    const passwordBenar = password_lama === user.password; //pakai bcrypt kalau sudah dienkripsi
    if (!passwordBenar) {
      return res.status(401).json({ message: 'Password lama salah.' });
    }

    // Update password
    await db.query(
      'UPDATE user SET password = ? WHERE user_id = ?',
      [password_baru, userId] // → pakai bcrypt.hash(password_baru, 10) jika terenkripsi
    );

    return res.status(200).json({ message: 'Password berhasil diperbarui.' });
  } catch (err) {
    console.error('ERROR updatePasswordGuru:', err);
    return res.status(500).json({ message: 'Gagal memperbarui password.', error: err.message });
  }
};

module.exports = { getProfileGuru, updateProfileGuru, updatePasswordGuru };