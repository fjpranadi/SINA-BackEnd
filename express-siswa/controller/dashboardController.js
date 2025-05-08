const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project

const getDashboardSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];           // hasil SELECT pertama


    if (!siswa) {
      return res.status(403).json({ message: 'Data biodata siswa tidak ditemukan' });
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
      message: `Data user dengan ID ${userId} berhasil diambil`,
      status: 200,
      biodata: {
        nis: siswa.nis,
        nama: siswa.nama_siswa,
        tempat_lahir: siswa.tempat_lahir,
        tanggal_lahir: siswa.tanggal_lahir,
        alamat: siswa.alamat,
        kelas: siswa.nama_kelas,
        tahun_akademik: siswa.tahun_akademik_id,  
      },
      jadwal_pelajaran: jadwalResult
      
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data dashboard.' });
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


module.exports = {getDashboardSiswa, editDataDiriSiswa };