const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

const getTugasTerbaru = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil guru_id dari user
    const [[guru]] = await db.query('SELECT guru_id FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [rows] = await db.query(`
      SELECT 
        t.tugas_id,
        t.nama_tugas,
        t.tanggal_mulai,
        t.tanggal_selesai,
        m.nama_mapel,
        k.nama_kelas
      FROM tugas t
      JOIN mapel m ON t.mapel_id = m.mapel_id
      JOIN kelas k ON t.kelas_id = k.kelas_id
      WHERE t.guru_id = ?
      ORDER BY t.tanggal_mulai DESC
    `, [guru.guru_id]);

    res.status(200).json({
      status: 200,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data tugas terbaru.' });
  }
};

module.exports = {
  getTugasTerbaru,
};