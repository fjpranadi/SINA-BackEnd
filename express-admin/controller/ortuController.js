const db = require('../database/db');

// Helper sederhana buat cek SQL Injection
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

const tambahOrtu = async (req, res) => {
  const {
    admin_user_id,
    username,
    email,
    password,
    nik,
    nama_ortu,
    imei,
    alamat,
    status_ortu,
    pekerjaan,
    tempat_lahir,
    tanggal_lahir,
    no_telepon
  } = req.body;

  // Validasi field wajib
  if (!admin_user_id || !username || !email || !password || !nik || !nama_ortu || !status_ortu || !no_telepon) {
    return res.status(400).json({ status: 400, message: 'Field wajib tidak boleh kosong!' });
  }

  // Validasi NIK
  if (!/^\d{16}$/.test(nik)) {
    return res.status(400).json({ status: 400, message: 'NIK harus 16 digit angka!' });
  }

  // Validasi tanggal lahir tidak boleh ke masa depan
  if (new Date(tanggal_lahir) > new Date()) {
    return res.status(400).json({ status: 400, message: 'Tanggal lahir tidak valid!' });
  }

  // Validasi sederhana anti SQL injection
  const inputsToCheck = [username, email, password, nik, nama_ortu, imei, alamat, status_ortu, pekerjaan, tempat_lahir, no_telepon];
  for (let val of inputsToCheck) {
    if (val && containsSQLInjection(val)) {
      return res.status(400).json({ status: 400, message: 'Input mengandung kata berbahaya (SQL Injection)' });
    }
  }

  try {
    await db.query('CALL admin_create_ortu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      admin_user_id,
      username,
      email,
      password,
      nik,
      nama_ortu,
      imei,
      alamat,
      status_ortu,
      pekerjaan,
      tempat_lahir,
      tanggal_lahir,
      no_telepon
    ]);

    res.status(201).json({ status: 201, message: 'Data orang tua berhasil ditambahkan!' });
  } catch (err) {
    console.error('Gagal menambahkan ortu:', err.message);
    res.status(500).json({ status: 500, message: 'Gagal menambahkan ortu.', error: err.message });
  }
};

const hapusOrtu = async (req, res) => {
  const { admin_user_id, ortu_user_id } = req.body;

  // Validasi input wajib
  if (!admin_user_id || !ortu_user_id) {
    return res.status(400).json({
      status: 400,
      message: 'admin_user_id dan ortu_user_id wajib diisi!'
    });
  }

  try {
    await db.query('CALL admin_delete_ortu(?, ?)', [
      admin_user_id,
      ortu_user_id
    ]);

    res.status(200).json({
      status: 200,
      message: 'Data orang tua berhasil dihapus!'
    });
  } catch (err) {
    console.error('Gagal menghapus ortu:', err.message);
    res.status(500).json({
      status: 500,
      message: 'Gagal menghapus ortu.',
      error: err.message
    });
  }
};

module.exports = { 
  tambahOrtu,
  hapusOrtu
 };
