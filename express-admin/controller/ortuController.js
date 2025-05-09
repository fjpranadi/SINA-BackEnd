const db = require('../database/db');

// Cek SQL Injection sederhana
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

const tambahOrtu = async (req, res) => {
  const {
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

  // Validasi input wajib
  if (!username || !email || !password || !nik || !nama_ortu || !status_ortu || !no_telepon) {
    return res.status(400).json({ status: 400, message: 'Field wajib tidak boleh kosong!' });
  }

  if (!/^\d{16}$/.test(nik)) {
    return res.status(400).json({ status: 400, message: 'NIK harus 16 digit angka!' });
  }

  if (new Date(tanggal_lahir) > new Date()) {
    return res.status(400).json({ status: 400, message: 'Tanggal lahir tidak valid!' });
  }

  const fieldsToCheck = [username, email, password, nik, nama_ortu, imei, alamat, status_ortu, pekerjaan, tempat_lahir, no_telepon];
  for (const val of fieldsToCheck) {
    if (val && containsSQLInjection(val)) {
      return res.status(400).json({ status: 400, message: 'Input mengandung kata berbahaya (SQL Injection)' });
    }
  }

  try {
    // Simpan ke tabel user
    const [userResult] = await db.query(`
      INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'ortu', NOW())
    `, [username, email, password]);

    const user_id = userResult.insertId;

    // Simpan ke tabel ortu
    await db.query(`
      INSERT INTO ortu (
        nik, user_id, nama_ortu, imei, alamat, status_ortu, pekerjaan,
        tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, foto_profil, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      nik,
      user_id,
      nama_ortu,
      imei || '',
      alamat || '',
      status_ortu,
      pekerjaan || '',
      tempat_lahir || '',
      tanggal_lahir,
      no_telepon,
      'default.jpg'
    ]);

    res.status(201).json({
      status: 201,
      message: 'Data orang tua berhasil ditambahkan!',
      user_id
    });

  } catch (err) {
    console.error('Gagal menambahkan ortu:', err.message);
    res.status(500).json({ status: 500, message: 'Gagal menambahkan ortu.', error: err.message });
  }
};

const hapusOrtu = async (req, res) => {
  const { ortu_user_id } = req.body;

  if (!ortu_user_id) {
    return res.status(400).json({ status: 400, message: 'ortu_user_id wajib diisi!' });
  }

  try {
    // Hapus data ortu
    await db.query('DELETE FROM ortu WHERE user_id = ?', [ortu_user_id]);

    // Hapus data user
    await db.query('DELETE FROM user WHERE user_id = ?', [ortu_user_id]);

    res.status(200).json({ status: 200, message: 'Data orang tua berhasil dihapus!' });

  } catch (err) {
    console.error('Gagal menghapus ortu:', err.message);
    res.status(500).json({ status: 500, message: 'Gagal menghapus ortu.', error: err.message });
  }
};

module.exports = {
  tambahOrtu,
  hapusOrtu
};
