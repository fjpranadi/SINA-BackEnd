const db = require('../database/db');

// Helper untuk deteksi kata berbahaya
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

const tambahSiswa = async (req, res) => {
  const {
    username, email, password, nis, nisn, nama, tanggal, tempat,
    alamat, telepon, kelamin, agama, admin_id
  } = req.body;

  // Validasi field wajib
  if (!username || !email || !password || !nis || !nisn || !nama || !tanggal || !tempat || !alamat || !telepon || !kelamin || !agama || !admin_id) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  // Validasi NIS 12 digit
  if (!/^\d{12}$/.test(nis)) {
    return res.status(400).json({ message: 'NIS harus terdiri dari 12 digit angka.' });
  }

  // Validasi nama maksimal 50 karakter
  if (nama.length > 50) {
    return res.status(400).json({ message: 'Nama maksimal 50 karakter.' });
  }

  // Cek inputan apakah mengandung kata berbahaya
  const inputFields = [username, email, password, nis, nisn, nama, tempat, alamat];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    const [result] = await db.query('CALL admin_create_siswa(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      username,
      email,
      password,
      nis,
      nisn,
      nama,
      tanggal,
      tempat,
      alamat,
      telepon,
      kelamin,
      agama,
      admin_id
    ]);

    res.status(201).json({
      message: result[0]?.status || 'Siswa berhasil ditambahkan!',
      user_id: result[0]?.user_id
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
    const [result] = await db.query('CALL admin_delete_siswa(?, ?)', [admin_id, siswa_user_id]);

    res.status(200).json({
      message: result[0]?.status || `Siswa dengan user_id ${siswa_user_id} berhasil dihapus!`
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
