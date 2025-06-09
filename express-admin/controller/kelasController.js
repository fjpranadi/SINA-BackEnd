const db = require('../database/db');
const jwt = require('jsonwebtoken'); // Tidak digunakan di kode ini
const bcrypt = require('bcryptjs'); // Tidak digunakan di kode ini
const crypto = require('crypto'); // Tidak digunakan di kode ini
const JWT_SECRET = 'token-jwt'; // Tidak digunakan di kode ini

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
  // Ambil jenjang dari req.body
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  // Tambahkan jenjang ke validasi field wajib
  if (!tahun_akademik_id || !guru_nip || !nama_kelas || !tingkat || !jenjang) {
    return res.status(400).json({ message: 'Semua field (termasuk jenjang) wajib diisi!' });
  }

  // Tambahkan jenjang ke pemeriksaan SQL Injection
  const inputFields = [guru_nip, nama_kelas, tingkat.toString(), jenjang];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    // Validasi guru_nip
    const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [guru_nip]);
    if (guruRows.length === 0) {
      return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan.' });
    }

    // Tambahkan jenjang ke query INSERT
    await db.query(
      `INSERT INTO kelas (tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang]
    );

    res.status(201).json({ message: 'Kelas berhasil ditambahkan.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan kelas.', error: error.message });
  }
};

// READ - Ambil Semua Kelas
const getAllKelas = async (req, res) => {
  try {
    // Tambahkan k.jenjang ke query SELECT
    const [rows] = await db.query(`
      SELECT 
        k.kelas_id,
        k.nama_kelas,
        k.tingkat,
        k.jenjang, 
        g.nama_guru AS wali_kelas,
        CONCAT(
          DATE_FORMAT(t.tahun_mulai, '%d %M %Y'), 
          ' sampai ', 
          DATE_FORMAT(t.tahun_berakhir, '%d %M %Y')
        ) AS tahun_akademik,
        DATE_FORMAT(k.created_at, '%d %M %Y') AS tanggal_dibuat
      FROM kelas k
      JOIN guru g ON k.guru_nip = g.nip
      JOIN tahun_akademik t ON k.tahun_akademik_id = t.tahun_akademik_id
      ORDER BY t.created_at DESC, k.jenjang, k.tingkat, k.nama_kelas
    `);

    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.' });
  }
};

// READ - Ambil Kelas by ID
const getKelasById = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // Tambahkan k.jenjang ke query SELECT
    const [rows] = await db.query(`
      SELECT 
        k.kelas_id,
        k.nama_kelas,
        k.tingkat,
        k.jenjang,
        g.nama_guru AS wali_kelas,
        CONCAT(
          DATE_FORMAT(t.tahun_mulai, '%d %M %Y'), 
          ' sampai ', 
          DATE_FORMAT(t.tahun_berakhir, '%d %M %Y')
        ) AS tahun_akademik,
        DATE_FORMAT(k.created_at, '%d %M %Y') AS tanggal_dibuat
      FROM kelas k
      JOIN guru g ON k.guru_nip = g.nip
      JOIN tahun_akademik t ON k.tahun_akademik_id = t.tahun_akademik_id
      WHERE k.kelas_id = ?
      ORDER BY k.created_at DESC
    `, [kelas_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' }); // Pesan error lebih spesifik
    }

    res.status(200).json(rows[0]); // Kembalikan objek tunggal, bukan array
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
  }
};

// UPDATE - Edit Kelas
const updateKelas = async (req, res) => {
  const { kelas_id } = req.params;
  // Ambil jenjang dari req.body
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  // Tambahkan jenjang ke validasi field wajib
  if (!tahun_akademik_id || !guru_nip || !nama_kelas || !tingkat || !jenjang) {
    return res.status(400).json({ message: 'Semua field (termasuk jenjang) wajib diisi!' });
  }
  
  // Tambahkan jenjang ke pemeriksaan SQL Injection
  const inputFields = [guru_nip, nama_kelas, tingkat.toString(), jenjang];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    const [kelasExist] = await db.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);
    if (kelasExist.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    
    // Validasi guru_nip jika diubah
    if (guru_nip && guru_nip !== kelasExist[0].guru_nip) {
        const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [guru_nip]);
        if (guruRows.length === 0) {
          return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan.' });
        }
    }


    // Tambahkan jenjang ke query UPDATE
    await db.query(
      `UPDATE kelas SET tahun_akademik_id = ?, guru_nip = ?, nama_kelas = ?, tingkat = ?, jenjang = ? WHERE kelas_id = ?`,
      [tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang, kelas_id]
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
    const [rows] = await db.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Kelas tidak ditemukan.' });

    // Tambahan: Periksa apakah ada siswa yang terdaftar di kelas ini sebelum menghapus
    const [siswaDiKelas] = await db.query(`SELECT COUNT(*) AS jumlah_siswa FROM krs WHERE kelas_id = ?`, [kelas_id]);
    if (siswaDiKelas[0].jumlah_siswa > 0) {
        return res.status(400).json({ message: `Tidak dapat menghapus kelas karena masih ada ${siswaDiKelas[0].jumlah_siswa} siswa terdaftar di kelas ini.` });
    }

    await db.query(`DELETE FROM kelas WHERE kelas_id = ?`, [kelas_id]);

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
    const [kelasExist] = await db.query('SELECT kelas_id, nama_kelas, jenjang, tingkat FROM kelas WHERE kelas_id = ?', [kelas_id]);
    if (kelasExist.length === 0) {
        return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    const [rows] = await db.query(` 
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        DATE_FORMAT(s.tanggal_lahir, '%d-%m-%Y') AS tanggal_lahir,
        s.tempat_lahir,
        s.alamat,
        s.jenis_kelamin,
        s.agama,
        s.no_telepon,
        s.foto_profil,
        DATE_FORMAT(s.created_at, '%d %M %Y %H:%i:%s') AS tanggal_daftar_siswa,
        krs.krs_id,
        krs.status_pembayaran
      FROM siswa s
      JOIN krs ON s.nis = krs.siswa_nis
      WHERE krs.kelas_id = ?
      ORDER BY s.nama_siswa ASC
    `, [kelas_id]);

    if (rows.length === 0) {
      return res.status(200).json({ 
          message: 'Tidak ada siswa di kelas ini.',
          kelas_info: kelasExist[0], // Kirim info kelas meskipun kosong
          siswa: [] 
      });
    }

    res.status(200).json({
        kelas_info: kelasExist[0],
        siswa: rows
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