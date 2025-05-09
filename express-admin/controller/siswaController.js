// controller/siswaController.js
const db = require('../database/db');

// Helper untuk deteksi kata berbahaya (SQL Injection)
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

const tambahSiswa = async (req, res) => {
  const {
    username, email, password, nis, nisn, nama, tanggal, tempat,
    alamat, telepon, kelamin, agama, admin_id
  } = req.body;

  if (!username || !email || !password || !nis || !nisn || !nama || !tanggal || !tempat || !alamat || !telepon || !kelamin || !agama || !admin_id) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  if (!/^\d{12}$/.test(nis)) {
    return res.status(400).json({ message: 'NIS harus terdiri dari 12 digit angka.' });
  }

  if (nama.length > 50) {
    return res.status(400).json({ message: 'Nama maksimal 50 karakter.' });
  }

  const inputFields = [username, email, password, nis, nisn, nama, tempat, alamat];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    // 1. Insert ke tabel user terlebih dahulu
    const insertUserQuery = `
      INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'siswa', NOW())
    `;
    const [userResult] = await db.query(insertUserQuery, [username, email, password]);
    const user_id = userResult.insertId;

    // 2. Insert ke tabel siswa menggunakan user_id dari tabel user
    const insertSiswaQuery = `
      INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, no_telepon, jenis_kelamin, agama, foto_profil, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;
    await db.query(insertSiswaQuery, [
      nis,
      user_id,
      nisn,
      nama,
      tanggal,
      tempat,
      alamat,
      telepon,
      kelamin,
      agama,
      'foto.jpg' // default foto
    ]);

    const siswaString = [
      nis,
      user_id,
      nisn,
      nama,
      tanggal,
      tempat,
      alamat,
      telepon,
      kelamin,
      agama,
      'foto.jpg',
      new Date().toISOString()
    ].join(' | ');

    res.status(201).json({
      message: 'Siswa berhasil ditambahkan!',
      siswa_string: siswaString
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal menambahkan data siswa.',
      error: err.sqlMessage || err.message
    });
  }
};

const hapusSiswa = async (req, res) => {
  const { admin_id, siswa_user_id } = req.body;

  if (!admin_id || !siswa_user_id) {
    return res.status(400).json({ message: 'admin_id dan siswa_user_id wajib diisi!' });
  }

  try {
    const [dataSiswa] = await db.query(`
      SELECT s.nis, s.user_id, s.nisn, s.nama_siswa, s.tanggal_lahir, s.tempat_lahir, s.alamat, 
             s.no_telepon, s.jenis_kelamin, s.agama, s.foto_profil, s.created_at
      FROM siswa s
      WHERE s.user_id = ?
    `, [siswa_user_id]);

    if (dataSiswa.length === 0) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan.' });
    }

    const siswa = dataSiswa[0];
    const siswaString = [
      siswa.nis,
      siswa.user_id,
      siswa.nisn,
      siswa.nama_siswa,
      siswa.tanggal_lahir,
      siswa.tempat_lahir,
      siswa.alamat,
      siswa.no_telepon,
      siswa.jenis_kelamin,
      siswa.agama,
      siswa.foto_profil || 'default.jpg',
      siswa.created_at
    ].join(' | ');

    // Hapus dari tabel siswa dulu
    await db.query('DELETE FROM siswa WHERE user_id = ?', [siswa_user_id]);

    // Hapus dari tabel user (jika kamu ingin juga menghapus akun user-nya)
    await db.query('DELETE FROM user WHERE user_id = ?', [siswa_user_id]);

    res.status(200).json({
      message: `Siswa dengan user_id ${siswa_user_id} berhasil dihapus!`,
      deleted_siswa_string: siswaString
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal menghapus data siswa.',
      error: err.sqlMessage || err.message
    });
  }
};

module.exports = {
  tambahSiswa,
  hapusSiswa
};