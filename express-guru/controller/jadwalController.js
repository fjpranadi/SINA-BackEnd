const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

const getJadwalKelas = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Cari nip guru berdasarkan user_id
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const guruNip = guru.nip;

    // Ambil jadwal berdasarkan guru_nip
    const [jadwalRows] = await db.query(`
      SELECT 
        mj.jadwal_id,
        mj.hari,
        mj.start,
        mj.finish,
        k.nama_kelas,
        m.nama_mapel
      FROM jadwal j
      JOIN master_jadwal mj ON j.jadwal_id = mj.jadwal_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN krs_detail kd ON m.mapel_id = kd.mapel_id
      WHERE kd.guru_nip = ? AND kd.mapel_id = j.mapel_id
      ORDER BY FIELD(mj.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'), mj.start
    `, [guruNip]);

    res.status(200).json({
      status: 200,
      data: jadwalRows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data jadwal guru.' });
  }
};

module.exports = {
  getJadwalKelas,
};