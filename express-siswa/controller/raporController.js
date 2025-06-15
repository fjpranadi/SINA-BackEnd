const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

const getListRapor = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIS dan nama siswa dari user_id
    const [[siswa]] = await db.query(
      'SELECT nis, nama_siswa FROM siswa WHERE user_id = ?',
      [userId]
    );

    if (!siswa) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan'
      });
    }

    const nis = siswa.nis;

    // Ambil data kelas dan tahun ajaran dengan semester otomatis
    const [rows] = await db.query(`
        SELECT 
        k.kelas_id,
        kls.tingkat,
        ta.tahun_akademik_id,
        RIGHT(ta.tahun_akademik_id, 1) AS semester
        FROM krs k
        JOIN kelas kls ON k.kelas_id = kls.kelas_id
        JOIN tahun_akademik ta ON kls.tahun_akademik_id = ta.tahun_akademik_id
        WHERE k.siswa_nis = ?
        GROUP BY k.kelas_id, kls.tingkat, ta.tahun_akademik_id
        ORDER BY ta.tahun_akademik_id
    `, [nis]);

    const data = rows.map(row => ({
        label: `${row.tingkat}/${row.semester} ${siswa.nama_siswa}`,
        kelas_id: row.kelas_id,
        tahun_akademik_id: row.tahun_akademik_id,
        semester: parseInt(row.semester)
    }));

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil list rapor',
      error: error.message
    });
  }
};


const getSemesterOptions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });

    const [rows] = await db.query(`
      SELECT 
        kls.kelas_id,
        ta.tahun_akademik_id,
        RIGHT(ta.tahun_akademik_id, 1) AS semester,
        CONCAT(kls.tingkat, '/', RIGHT(ta.tahun_akademik_id, 1), ' ', kls.nama_kelas) AS label
      FROM krs k
      JOIN kelas kls ON k.kelas_id = kls.kelas_id
      JOIN tahun_akademik ta ON kls.tahun_akademik_id = ta.tahun_akademik_id
      WHERE k.siswa_nis = ?
      GROUP BY kls.kelas_id, ta.tahun_akademik_id
      ORDER BY ta.tahun_mulai ASC
    `, [siswa.nis]);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data opsi semester', error: error.message });
  }
};

const getStatistikNilai = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { kelas_id, tahun_akademik_id } = req.query;

    if (!kelas_id || !tahun_akademik_id) {
      return res.status(400).json({
        success: false,
        message: 'kelas_id dan tahun_akademik_id wajib diisi'
      });
    }

    // Ambil NIS siswa
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan'
      });
    }

    // Ambil data nilai berdasarkan krs_detail, join ke kelas untuk filter tahun_akademik
    const [rows] = await db.query(`
      SELECT 
        mp.nama_mapel,
        kd.nilai
      FROM krs k
      JOIN krs_detail kd ON k.krs_id = kd.krs_id
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      JOIN kelas kls ON k.kelas_id = kls.kelas_id
      WHERE k.siswa_nis = ?
        AND kls.kelas_id = ?
        AND kls.tahun_akademik_id = ?
    `, [siswa.nis, kelas_id, tahun_akademik_id]);

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil statistik nilai',
      error: error.message
    });
  }
};

module.exports = {
    getListRapor,
    getSemesterOptions,
    getStatistikNilai
};

