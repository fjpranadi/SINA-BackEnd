const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

// Ambil daftar mapel yang diajar guru
const getMapelByGuru = async (req, res) => {
  const userId = req.user.userId;
  try {
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan' });

    const [mapel] = await db.query(`
      SELECT DISTINCT kd.mapel_id, m.nama_mapel
      FROM krs_detail kd
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      WHERE kd.guru_nip = ?
    `, [guru.nip]);

    res.json({ success: true, data: mapel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data mapel', error: err.message });
  }
};

// Ambil daftar kelas berdasarkan mapel yang diajar guru
const getKelasByMapelGuru = async (req, res) => {
  const userId = req.user.userId;
  const { mapel_id } = req.params;
  try {
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan' });

    const [kelas] = await db.query(`
      SELECT DISTINCT k.kelas_id, kl.nama_kelas
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN kelas kl ON k.kelas_id = kl.kelas_id
      WHERE kd.mapel_id = ? AND kd.guru_nip = ?
    `, [mapel_id, guru.nip]);

    res.json({ success: true, data: kelas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas', error: err.message });
  }
};

// Ambil daftar siswa berdasarkan kelas dan mapel
const getSiswaByKelasAndMapel = async (req, res) => {
  const userId = req.user.userId;
  const { mapel_id, kelas_id } = req.params;

  try {
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan' });

    const [rows] = await db.query(`
      SELECT 
        s.nis,
        s.nama_siswa,
        kd.krs_id,
        kd.nilai
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE kd.mapel_id = ? AND kd.guru_nip = ? AND k.kelas_id = ?
    `, [mapel_id, guru.nip, kelas_id]);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal ambil list siswa', error: err.message });
  }
};

// Input nilai rapor oleh guru
const inputNilaiRaporGuru = async (req, res) => {
  const userId = req.user.userId;
  const { krs_id, status } = req.params;
  const { mapel_id, nilai } = req.body;

  try {
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan' });

    const [[cek]] = await db.query(`
      SELECT nilai FROM krs_detail
      WHERE krs_id = ? AND mapel_id = ? AND guru_nip = ?
    `, [krs_id, mapel_id, guru.nip]);

    if (!cek) return res.status(404).json({ message: 'Data nilai tidak ditemukan' });

    await db.query(`
      UPDATE krs_detail
      SET nilai = ?
      WHERE krs_id = ? AND mapel_id = ? AND guru_nip = ?
    `, [nilai, krs_id, mapel_id, guru.nip]);

    return res.status(200).json({
      success: true,
      message: `Nilai berhasil disimpan`
    });

  } catch (err) {
    console.error(' ERROR:', err);
    return res.status(500).json({
      message: 'Gagal menyimpan nilai rapor',
      error: err.message
    });
  }
};
const getStatistikNilaiBySiswaAndTahun = async (req, res) => {
  const { krs_id } = req.params;
  const { tahun_akademik_id } = req.query;

  if (!tahun_akademik_id) {
    return res.status(400).json({
      success: false,
      message: 'tahun_akademik_id wajib diisi'
    });
  }

  try {
    const [rows] = await db.query(`
      SELECT 
        m.nama_mapel,
        kd.nilai,
        DATE_FORMAT(ta.tahun_mulai, '%Y-%m-%d') AS tahun_mulai,
        kl.tingkat AS tingkat
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      JOIN kelas kl ON k.kelas_id = kl.kelas_id
      JOIN tahun_akademik ta ON kl.tahun_akademik_id = ta.tahun_akademik_id
      WHERE k.krs_id = ? AND ta.tahun_akademik_id LIKE CONCAT(?, '%')
    `, [krs_id, tahun_akademik_id]);

    res.status(200).json({
      success: true,
      data: rows
    });
  } catch (err) {
    console.error('getStatistikNilaiBySiswaAndTahun error:', err);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data statistik',
      error: err.message
    });
  }
};


module.exports = {
  getMapelByGuru,
  getKelasByMapelGuru,
  getSiswaByKelasAndMapel,
  inputNilaiRaporGuru,
  getStatistikNilaiBySiswaAndTahun 
}
