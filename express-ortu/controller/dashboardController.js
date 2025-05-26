const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project
const fs = require('fs');
const path = require('path');


const getBiodataOrtu = async (req, res) => {
  const userId = req.user.userId; // diambil dari JWT

  try {
    const [rows] = await db.query(
      'SELECT * FROM ortu WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data orang tua tidak ditemukan.' });
    }

    return res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error('Error saat mengambil data orang tua:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getSiswaByOrtu = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil NIK ortu berdasarkan user_id
    const [ortuRows] = await db.query(
      'SELECT nik FROM ortu WHERE user_id = ?',
      [userId]
    );

    if (ortuRows.length === 0) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan.' });
    }

    const nikOrtu = ortuRows[0].nik;

    // 2. Ambil data siswa yang terhubung dengan NIK ortu, lalu join ke tabel siswa
    const [siswaRows] = await db.query(`
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        s.no_telepon,
        s.foto_profil
      FROM siswa_ortu so
      LEFT JOIN siswa s ON so.nis = s.nis
      WHERE so.nik = ?
    `, [nikOrtu]);

    if (siswaRows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada siswa yang terhubung dengan ortu ini.' });
    }

    return res.status(200).json({ data: siswaRows });
  } catch (error) {
    console.error('Gagal mengambil data siswa:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
};

const getBerita = async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        b.berita_id, 
        b.judul, 
        b.foto, 
        b.isi, 
        b.tipe,
        b.created_at,
        g.nama_guru,
        u.username AS nama_admin
      FROM berita b
      LEFT JOIN guru g ON b.guru_nip = g.nip
      LEFT JOIN admin a ON b.admin_id = a.admin_id
      LEFT JOIN user u ON a.user_id = u.user_id
      ORDER BY b.created_at DESC;

    `);

    res.status(200).json({
      message: "Data berita berhasil diambil",
      status: 200,
      data: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Gagal mengambil data berita",
      error: err.message
    });
  }
};

const editBiodataOrtu = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Ambil data ortu lama
    const [existingData] = await db.query('SELECT * FROM ortu WHERE user_id = ?', [userId]);
    if (existingData.length === 0) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan.' });
    }

    const ortu = existingData[0];

    // Ambil data dari body atau gunakan yang lama
    const tempat_lahir_ortu = req.body.tempat_lahir_ortu || ortu.tempat_lahir_ortu;
    const tanggal_lahir_ortu = req.body.tanggal_lahir_ortu || ortu.tanggal_lahir_ortu;
    const no_telepon = req.body.no_telepon || ortu.no_telepon;
    const alamat = req.body.alamat || ortu.alamat;
    const pekerjaan = req.body.pekerjaan || ortu.pekerjaan;
    const status_ortu = req.body.status_ortu || ortu.status_ortu;

    // Cek apakah ada file foto profil baru
    let foto_profil = ortu.foto_profil;
    if (req.file && req.file.filename) {
      foto_profil = req.file.filename;
    }

    // Update ke DB
    await db.query(`
      UPDATE ortu SET 
        tempat_lahir_ortu = ?, 
        tanggal_lahir_ortu = ?, 
        no_telepon = ?, 
        alamat = ?, 
        pekerjaan = ?, 
        status_ortu = ?, 
        foto_profil = ?
      WHERE user_id = ?
    `, [
      tempat_lahir_ortu,
      tanggal_lahir_ortu,
      no_telepon,
      alamat,
      pekerjaan,
      status_ortu,
      foto_profil,
      userId
    ]);

    return res.status(200).json({ message: 'Biodata ortu berhasil diperbarui.' });

  } catch (error) {
    console.error('Gagal update biodata ortu:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan saat mengupdate biodata.' });
  }
};

const ubahPasswordOrtu = async (req, res) => {
  const userId = req.user.userId;
  const { password_lama, password_baru, konfirmasi_password } = req.body;

  if (!password_lama || !password_baru || !konfirmasi_password) {
    return res.status(400).json({ message: "Semua field wajib diisi." });
  }

  if (password_baru !== konfirmasi_password) {
    return res.status(400).json({ message: "Konfirmasi password tidak cocok." });
  }

  try {
    // Ambil password lama dari tabel user
    const [userRows] = await db.query('SELECT password FROM user WHERE user_id = ?', [userId]);

    if (userRows.length === 0) {
      return res.status(404).json({ message: "User tidak ditemukan." });
    }

    const passwordTersimpan = userRows[0].password;

    // Cek kecocokan password lama
    if (password_lama !== passwordTersimpan) {
      return res.status(401).json({ message: "Password lama salah." });
    }

    // Update password langsung
    await db.query('UPDATE user SET password = ? WHERE user_id = ?', [password_baru, userId]);

    return res.status(200).json({ message: "Password berhasil diubah." });
  } catch (error) {
    console.error("Gagal mengubah password:", error);
    return res.status(500).json({ message: "Terjadi kesalahan server." });
  }
};

const getInformasiAnakByNis = async (req, res) => {
  const userId = req.user.userId;
  const nis = req.params.nis;
  const today = new Date().toISOString().split('T')[0];

  try {
    // 1. Ambil nik ortu dari user
    const [ortuRows] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (ortuRows.length === 0) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan.' });
    }
    const nik = ortuRows[0].nik;

    // 2. Cek apakah nis ini anak dari ortu tsb
    const [checkNis] = await db.query('SELECT * FROM siswa_ortu WHERE nik = ? AND nis = ?', [nik, nis]);
    if (checkNis.length === 0) {
      return res.status(403).json({ message: 'Siswa ini tidak terhubung dengan akun ortu Anda.' });
    }

    // Ambil semua krs_id milik siswa berdasarkan NIS
    const [krsResult] = await db.query(`
      SELECT krs.krs_id
      FROM krs
      JOIN siswa ON siswa.nis = krs.siswa_nis
      WHERE siswa.nis = ?
    `, [nis]);

    const krsIds = krsResult.map(row => row.krs_id);
    if (krsIds.length === 0) {
      return res.json({
        data: {
          nis,
          tugas_belum_dikerjakan: 0,
          tugas_terlambat: 0,
          materi_hari_ini: 0,
          absensi_tidak_hadir: 0
        }
      });
    }

    const placeholders = krsIds.map(() => '?').join(',');

    // 1. Tugas belum dikerjakan
    const [belumDikerjakan] = await db.query(`
      SELECT COUNT(*) AS total
      FROM tugas
      WHERE krs_id IN (${placeholders}) AND tanggal_pengumpulan IS NULL
    `, krsIds);

    // 2. Tugas terlambat
    // 2. Tugas terlambat
    const [terlambat] = await db.query(`
      SELECT COUNT(*) AS total
      FROM tugas
      WHERE 
        krs_id IN (${placeholders})
        AND tanggal_pengumpulan IS NOT NULL
        AND tanggal_pengumpulan > tenggat_kumpul
    `, krsIds);


    // 3. Materi hari ini
    const [materiHariIni] = await db.query(`
      SELECT COUNT(*) AS total
      FROM materi
      WHERE krs_id IN (${placeholders}) AND DATE(created_at) = CURDATE()
    `, krsIds);

    // 4. Absensi tidak hadir
    const [tidakHadir] = await db.query(`
      SELECT COUNT(*) AS total
      FROM absensi
      WHERE krs_id IN (${placeholders}) AND keterangan IN ('I', 'S', 'A')
    `, krsIds);

    res.json({
      data: {
        nis,
        tugas_belum_dikerjakan: belumDikerjakan[0].total,
        tugas_terlambat: terlambat[0].total,
        materi_hari_ini: materiHariIni[0].total,
        absensi_tidak_hadir: tidakHadir[0].total
      }
    });

  } catch (err) {
    console.error('Error getInformasiAnakByNis:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};



module.exports = {getBiodataOrtu, getSiswaByOrtu, getBerita, editBiodataOrtu, ubahPasswordOrtu, getInformasiAnakByNis};