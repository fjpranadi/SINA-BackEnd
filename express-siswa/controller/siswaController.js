const db = require('../database/db');

// Helper buat cek kata-kata berbahaya
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  const lowerInput = input.toLowerCase();
  return forbiddenWords.some(word => lowerInput.includes(word));
};

const tambahSiswa = async (req, res) => {
  const { username, email, password, nis, nisn, nama, tanggal, tempat, alamat, kelamin, agama } = req.body;

  // Cek field wajib
  if (!username || !email || !password || !nis || !nisn || !nama || !tanggal || !tempat || !alamat || !kelamin || !agama) {
    console.log({
      status: 400,
      message: 'Semua field wajib diisi ya!'
    });
    return res.status(400).json({
      status: 400,
      message: 'Semua field wajib diisi!'
    });
  }

  // Validasi NIS 12 digit
  if (!/^\d{12}$/.test(nis)) {
    console.log({
      status: 400,
      message: 'NIS harus terdiri dari 12 digit angka.'
    });
    return res.status(400).json({
      status: 400,
      message: 'NIS harus terdiri dari 12 digit angka.'
    });
  }

  // Validasi nama max 50 karakter
  if (nama.length > 50) {
    console.log({
      status: 400,
      message: 'Nama maksimal 50 karakter.'
    });
    return res.status(400).json({
      status: 400,
      message: 'Nama maksimal 50 karakter.'
    });
  }

  // Validasi anti SQL Injection sederhana
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter'];
  const inputValues = [username, email, password, nis, nisn, nama, tempat, alamat];

  for (let value of inputValues) {
    for (let word of forbiddenWords) {
      if (value.toLowerCase().includes(word)) {
        console.log({
          status: 400,
          message: 'Input mengandung kata terlarang (potensi SQL Injection).'
        });
        return res.status(400).json({
          status: 400,
          message: 'Input mengandung kata terlarang (potensi SQL Injection).'
        });
      }
    }
  }

  try {
    await db.query('CALL create_siswa(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      username,
      email,
      password,
      nis,
      nisn,
      nama,
      tanggal,
      tempat,
      alamat,
      kelamin,
      agama
    ]);
    console.log({
      status: 201,
      message: 'Data siswa berhasil ditambahkan!'
    });
    res.status(201).json({
      status: 201,
      message: 'Data siswa berhasil ditambahkan!'
    });
  } catch (err) {
    console.error({
      status: 500,
      message: 'Gagal menambahkan data siswa.',
      error: err.message
    });
    res.status(500).json({
      status: 500,
      message: 'Gagal menambahkan data siswa.',
      error: err.message
    });
  }
};


const cariSiswa = async (req, res) => {
  const { keyword } = req.query;

  try {
    const [results] = await db.query('CALL daftar_siswa(?)', [keyword || '']);
    res.status(200).json(results[0]); // karena hasil CALL biasanya nested
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data siswa.' });
  }
};

const editSiswa = async (req, res) => {
  const { nis } = req.params;
  const { nama, tanggal, tempat, alamat, kelamin, agama } = req.body;

  if (!nama || !tanggal || !tempat || !alamat || !kelamin || !agama) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    await db.query('CALL edit_siswa(?, ?, ?, ?, ?, ?, ?)', [
      nis,
      nama,
      tanggal,
      tempat,
      alamat,
      kelamin,
      agama
    ]);
    res.status(200).json({ message: 'Data siswa berhasil diperbarui!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengedit data siswa.', error: err.message });
  }
};

const deleteSiswa = async (req, res) => {
  const { nis } = req.params;

  try {
    await db.query('CALL delete_siswa(?)', [nis]);
    res.status(200).json({ message: `Siswa dengan NIS ${nis} berhasil dihapus!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus data siswa.', error: err.message });
  }
};



module.exports = { tambahSiswa, cariSiswa, editSiswa, deleteSiswa  };
