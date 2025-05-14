const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project

const getBiodataSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];

    if (!siswa) {
      return res.status(403).json({ message: 'Data biodata siswa tidak ditemukan' });
    }

    res.status(200).json({
      message: `Biodata siswa dengan ID ${userId} berhasil diambil`,
      status: 200,
      biodata: {
        nis: siswa.nis,
        nama: siswa.nama_siswa,
        tempat_lahir: siswa.tempat_lahir,
        tanggal_lahir: siswa.tanggal_lahir,
        alamat: siswa.alamat,
        kelas: siswa.nama_kelas,
        tahun_akademik: siswa.tahun_akademik_id,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil biodata siswa.' });
  }
};

const getJadwalSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Ambil NIS siswa dari prosedur
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];

    if (!siswa) {
      return res.status(403).json({ message: 'Data siswa tidak ditemukan' });
    }

    const [jadwalResult] = await db.query(`
      SELECT mj.hari, mj.start, mj.finish, m.nama_mapel, g.nama_guru
      FROM master_jadwal mj
      LEFT JOIN jadwal j ON mj.jadwal_id = j.jadwal_id
      LEFT JOIN mapel m ON j.mapel_id = m.mapel_id
      LEFT JOIN kelas k ON j.kelas_id = k.kelas_id
      LEFT JOIN guru g ON k.guru_nip = g.nip
      WHERE j.kelas_id = (
        SELECT kelas_id FROM krs WHERE siswa_nis = ?
        LIMIT 1
      )
    `, [siswa.nis]);

    res.status(200).json({
      message: `Jadwal siswa dengan ID ${userId} berhasil diambil`,
      status: 200,
      jadwal_pelajaran: jadwalResult
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil jadwal siswa.' });
  }
};


const editDataDiriSiswa = async (req, res) => {
  const userId = req.user.userId; // Ambil user ID dari token
  const { nama, tempat_lahir, tanggal_lahir, alamat } = req.body;

  try {
    // Cari siswa berdasarkan user_id
    const [[siswa]] = await db.query('SELECT * FROM siswa WHERE user_id = ?', [userId]);

    if (!siswa) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    // Update biodata siswa
    await db.query(
      `UPDATE siswa 
       SET nama_siswa = ?, tempat_lahir = ?, tanggal_lahir = ?, alamat = ? 
       WHERE user_id = ?`,
      [nama, tempat_lahir, tanggal_lahir, alamat, userId]
    );

    res.status(200).json({
      message: `Biodata siswa dengan user ID ${userId} berhasil diperbarui`,
      status: 200
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Terjadi kesalahan saat memperbarui biodata siswa',
      error: err.message
    });
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

const getMateriSiswa = async (req, res) => {
  const userId = req.user.userId; // Dari token
  const { jadwal_id } = req.params;

  try {
    // 1. Ambil data siswa berdasarkan user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil kelas siswa dari tabel KRS
    const [[krs]] = await db.query('SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });
    }

    // 3. Verifikasi jadwal sesuai dengan kelas siswa
    const [[jadwal]] = await db.query(
      `SELECT * FROM jadwal WHERE jadwal_id = ? AND kelas_id = ?`,
      [jadwal_id, krs.kelas_id]
    );

    if (!jadwal) {
      return res.status(403).json({ message: 'Jadwal tidak valid untuk kelas siswa' });
    }

    // 4. Ambil materi dari mapel di jadwal tersebut
    const [materiList] = await db.query(
      `SELECT m.materi_id, m.nama_materi, m.uraian, m.lampiran, m.created_at
       FROM materi m
       WHERE m.krs_id IN (
         SELECT krs_id FROM krs WHERE siswa_nis = ?
       )
       AND m.mapel_id = ?`,
      [siswa.nis, jadwal.mapel_id]
    );

    res.status(200).json({
      message: 'Data materi berhasil diambil',
      status: 200,
      data: materiList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil data materi',
      error: err.message
    });
  }
};

const getTugasSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { jadwal_id } = req.params;

  try {
    // 1. Ambil NIS siswa dari user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil kelas siswa dari KRS
    const [[krs]] = await db.query('SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });
    }

    // 3. Verifikasi jadwal milik kelas siswa
    const [[jadwal]] = await db.query(
      `SELECT * FROM jadwal WHERE jadwal_id = ? AND kelas_id = ?`,
      [jadwal_id, krs.kelas_id]
    );
    if (!jadwal) {
      return res.status(403).json({ message: 'Jadwal tidak valid untuk kelas siswa' });
    }

    // 4. Ambil tugas dari mapel tersebut
    const [tugasList] = await db.query(
      `SELECT 
         t.tugas_id,
         t.judul,
         t.deskripsi,
         t.lampiran,
         t.tenggat_kumpul,
         t.tanggal_pengumpulan,
         t.nilai
       FROM tugas t
       WHERE t.krs_id IN (
         SELECT krs_id FROM krs WHERE siswa_nis = ?
       )
       AND t.mapel_id = ?`,
      [siswa.nis, jadwal.mapel_id]
    );

    res.status(200).json({
      message: 'Data tugas berhasil diambil',
      status: 200,
      data: tugasList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil data tugas',
      error: err.message
    });
  }
};





module.exports = {getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa };