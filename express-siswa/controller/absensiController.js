const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

const getAbsensi = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIS berdasarkan user_id
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }
    const nis = siswa.nis;

    // Ambil data KRS
    const [[krs]] = await db.query('SELECT kelas_id, krs_id FROM krs WHERE siswa_nis = ?', [nis]);
    if (!krs) {
      return res.status(404).json({ status: 404, message: 'Data KRS tidak ditemukan.' });
    }

    const kelasId = krs.kelas_id;
    const krsId = krs.krs_id;

    // Ambil data absensi yang valid sesuai jadwal dan mapel siswa
    const [rows] = await db.query(`
      SELECT 
        abs.keterangan,
        abs.tanggal,
        abs.surat,
        abs.mapel_id,
        mp.nama_mapel,
        abs.jadwal_id,
        kls.nama_kelas
      FROM absensi abs
      JOIN krs ON abs.krs_id = krs.krs_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      JOIN mapel mp ON abs.mapel_id = mp.mapel_id
      JOIN jadwal j ON abs.jadwal_id = j.jadwal_id AND abs.mapel_id = j.mapel_id AND j.kelas_id = krs.kelas_id
      WHERE krs.siswa_nis = ?
      ORDER BY abs.tanggal DESC
    `, [nis]);

    res.status(200).json({
      status: 200,
      total: rows.length,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data absensi.' });
  }
};

const getRingkasanAbsensi = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIS siswa dari userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }

    const [[krs]] = await db.query('SELECT krs_id FROM krs WHERE siswa_nis = ?', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ status: 404, message: 'KRS tidak ditemukan.' });
    }

    const [[jumlah]] = await db.query(`
      SELECT 
        SUM(keterangan = 's') AS sakit,
        SUM(keterangan = 'i') AS izin,
        SUM(keterangan = 'a') AS alpha,
        SUM(keterangan = 'h') AS hadir
      FROM absensi
      WHERE krs_id = ?
    `, [krs.krs_id]);

    res.status(200).json({
      status: 200,
      data: {
        sakit: jumlah.sakit || 0,
        izin: jumlah.izin || 0,
        alpha: jumlah.alpha || 0,
        hadir: jumlah.hadir || 0
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data absensi.' });
  }
};

module.exports = { getAbsensi, getRingkasanAbsensi  };