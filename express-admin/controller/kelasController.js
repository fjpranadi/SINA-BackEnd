const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};
 
// CREATE - Tambah Kelas
const tambahKelas = async (req, res) => {
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat } = req.body;

  if (!tahun_akademik_id || !guru_nip || !nama_kelas || !tingkat) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  const inputFields = [guru_nip, nama_kelas, tingkat.toString()];
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

    await db.query(
      `INSERT INTO kelas (tahun_akademik_id, guru_nip, nama_kelas, tingkat, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [tahun_akademik_id, guru_nip, nama_kelas, tingkat]
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
          const [rows] = await db.query(`
            SELECT 
              k.kelas_id,
              k.nama_kelas,
              k.tingkat,
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
            ORDER BY t.created_at DESC
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
      const [rows] = await db.query(`
        SELECT 
          k.kelas_id,
          k.nama_kelas,
          k.tingkat,
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
        return res.status(404).json({ message: 'Tahun akademik tidak ditemukan atau belum memiliki kelas.' });
      }
  
      res.status(200).json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
    }
  };

// UPDATE - Edit Kelas
const updateKelas = async (req, res) => {
  const { kelas_id } = req.params;
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat } = req.body;

  if (!tahun_akademik_id || !guru_nip || !nama_kelas || !tingkat) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    const [kelasExist] = await db.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);
    if (kelasExist.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    await db.query(
      `UPDATE kelas SET tahun_akademik_id = ?, guru_nip = ?, nama_kelas = ?, tingkat = ? WHERE kelas_id = ?`,
      [tahun_akademik_id, guru_nip, nama_kelas, tingkat, kelas_id]
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
    const [rows] = await db.query(`
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        s.tanggal_lahir,
        s.tempat_lahir,
        s.alamat,
        s.jenis_kelamin,
        s.agama,
        s.no_telepon,
        s.foto_profil,
        s.created_at,
        k.kelas_id,
        krs.krs_id,
        krs.status_pembayaran
      FROM siswa s
      JOIN krs ON s.nis = krs.siswa_nis
      JOIN kelas k ON krs.kelas_id = k.kelas_id
      WHERE k.kelas_id = ?
      ORDER BY s.nama_siswa ASC
    `, [kelas_id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada siswa di kelas ini atau kelas tidak ditemukan.' });
    }

    res.status(200).json(rows);
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
