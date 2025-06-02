const db = require('../database/db');
const { v4: uuidv4 } = require('uuid'); // Diperlukan untuk generate kelas_id

// const jwt = require('jsonwebtoken'); // Tidak digunakan di kode ini
// const bcrypt = require('bcryptjs'); // Tidak digunakan di kode ini
// const crypto = require('crypto'); // Tidak digunakan di kode ini
// const JWT_SECRET = 'token-jwt'; // Tidak digunakan di kode ini

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
  // Pastikan input adalah string sebelum memanggil toLowerCase()
  if (typeof input !== 'string') {
    return false;
  }
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Kelas
const tambahKelas = async (req, res) => {
  const { tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  if (!tahun_akademik_id || !kurikulum_id || !guru_nip || !nama_kelas || !tingkat || !jenjang) {
    return res.status(400).json({ message: 'Semua field (tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang) wajib diisi!' });
  }

  const inputFields = [guru_nip, nama_kelas, jenjang]; 
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }
  if (typeof tingkat !== 'string' && typeof tingkat !== 'number') {
    return res.status(400).json({ message: 'Tingkat harus berupa string atau angka.' });
  }
  const tingkatStr = tingkat.toString();
  if (containsSQLInjection(tingkatStr)) {
      return res.status(400).json({ message: 'Input tingkat mengandung kata terlarang (potensi SQL Injection).' });
  }

  try {
    // Validasi guru_nip
    const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [guru_nip]);
    if (guruRows.length === 0) {
      return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan.' });
    }

    // Generate kelas_id menggunakan UUID
    const kelas_id_baru = uuidv4();

    // Panggil stored procedure admin_create_kelas dengan kelas_id yang di-generate
    // SP yang baru membutuhkan kelas_id sebagai parameter input.
    await db.query(
      'CALL admin_create_kelas(?, ?, ?, ?, ?, ?, ?)', // Sekarang 7 parameter
      [kelas_id_baru, tahun_akademik_id, kurikulum_id, guru_nip, jenjang, nama_kelas, tingkatStr]
    );

    res.status(201).json({ message: 'Kelas berhasil ditambahkan.', kelas_id: kelas_id_baru });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan kelas.', error: error.message });
  }
};

// READ - Ambil Semua Kelas
const getAllKelas = async (req, res) => {
  try {
    // Panggil stored procedure admin_read_kelas dengan NULL untuk target_kelas_id dan tahun_akademik_id
    const [rows] = await db.query('CALL admin_read_kelas(NULL, NULL)');
    
    // rows[0] berisi data mentah dari stored procedure
    // Stored procedure admin_read_kelas mengembalikan:
    // k.kelas_id, k.nama_kelas, k.tingkat, g.nama_guru, k.jenjang, 
    // t.tahun_mulai, t.tahun_berakhir, k.created_at
    const kelasData = rows[0];

    res.status(200).json(kelasData); // Mengembalikan data mentah dari SP
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
  }
};

// READ - Ambil Kelas by ID
const getKelasById = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // Panggil stored procedure admin_read_kelas dengan kelas_id dan NULL untuk tahun_akademik_id
    const [rows] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    const kelasData = rows[0]; 

    if (kelasData.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    // Mengembalikan data mentah objek pertama dari SP
    // Stored procedure admin_read_kelas mengembalikan:
    // k.kelas_id, k.nama_kelas, k.tingkat, g.nama_guru, k.jenjang, 
    // t.tahun_mulai, t.tahun_berakhir, k.created_at
    res.status(200).json(kelasData[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
  }
};

// UPDATE - Edit Kelas
const updateKelas = async (req, res) => {
  const { kelas_id } = req.params;
  const { tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  if (!tahun_akademik_id || !kurikulum_id || !guru_nip || !nama_kelas || !tingkat || !jenjang) {
    return res.status(400).json({ message: 'Semua field (tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang) wajib diisi untuk update!' });
  }
  
  const inputFields = [guru_nip, nama_kelas, jenjang];
    if (typeof tingkat !== 'string' && typeof tingkat !== 'number') {
    return res.status(400).json({ message: 'Tingkat harus berupa string atau angka.' });
  }
  const tingkatStr = tingkat.toString();

  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }
  if (containsSQLInjection(tingkatStr)) {
      return res.status(400).json({ message: 'Input tingkat mengandung kata terlarang (potensi SQL Injection).' });
  }

  try {
    // Cek apakah kelas ada (menggunakan SP admin_read_kelas dengan parameter kedua NULL)
    const [kelasExistResult] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    if (kelasExistResult[0].length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    
    // const kelasSaatIni = kelasExistResult[0][0]; // Tidak digunakan jika validasi NIP disederhanakan
    if (guru_nip) { 
        const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [guru_nip]);
        if (guruRows.length === 0) {
          return res.status(404).json({ message: 'Guru dengan NIP baru tersebut tidak ditemukan.' });
        }
    }

    await db.query(
      'CALL admin_update_kelas(?, ?, ?, ?, ?, ?, ?)',
      [kelas_id, tahun_akademik_id, kurikulum_id, guru_nip, jenjang, nama_kelas, tingkatStr]
    );

    res.status(200).json({ message: 'Data kelas berhasil diupdate.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui data kelas.', error: error.message });
  }
};

// DELETE - Hapus Kelas
const hapusKelas = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    const [kelasExistResult] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    if (kelasExistResult[0].length === 0) {
        return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    const [siswaDiKelasResult] = await db.query(`CALL sp_read_siswa_from_kelas(?)`, [kelas_id]);
    const siswaDiKelas = siswaDiKelasResult[0];

    if (siswaDiKelas.length > 0) {
      return res.status(400).json({ message: `Tidak dapat menghapus kelas karena masih ada ${siswaDiKelas.length} siswa terdaftar di kelas ini.` });
    }

    await db.query('CALL admin_delete_kelas(?)', [kelas_id]);

    res.status(200).json({ message: 'Kelas berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghapus kelas.', error: error.message });
  }
};

// GET - Ambil semua siswa berdasarkan kelas_id
const getSiswaByKelasId = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    const [kelasInfoResult] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    if (kelasInfoResult[0].length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    // Mengembalikan data mentah info kelas dari SP admin_read_kelas
    const kelasInfoData = kelasInfoResult[0][0]; 

    const [siswaResult] = await db.query('CALL sp_read_siswa_from_kelas(?)', [kelas_id]);
    const siswaData = siswaResult[0]; 

    // SP sp_read_siswa_from_kelas mengembalikan: 
    // s.nama_siswa, s.foto_profil, s.nis, s.nisn, s.jenis_kelamin
    // Ini akan dikembalikan apa adanya.

    if (siswaData.length === 0) {
      return res.status(200).json({ 
        message: 'Tidak ada siswa di kelas ini.',
        kelas_info: kelasInfoData, // Mengembalikan data mentah kelas info
        siswa: [] 
      });
    }
    
    res.status(200).json({
      kelas_info: kelasInfoData, // Mengembalikan data mentah kelas info
      siswa: siswaData 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data siswa berdasarkan kelas.', error: error.message });
  }
};


module.exports = {
  tambahKelas,
  getAllKelas,
  getKelasById,
  updateKelas,
  hapusKelas,
  getSiswaByKelasId
};
