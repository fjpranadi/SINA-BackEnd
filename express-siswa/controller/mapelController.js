const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

// GET jumlah tugas dan jumlah materi
const getJumlahTugasMateri = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIS siswa berdasarkan userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }

    // Ambil semua mapel dan krs_id yang terkait siswa tersebut
    const [mapelKrsList] = await db.query(`
      SELECT kd.mapel_id, kd.krs_id
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      WHERE k.siswa_nis = ?
    `, [siswa.nis]);

    if (mapelKrsList.length === 0) {
      return res.status(404).json({ status: 404, message: 'Tidak ada mapel yang terkait dengan siswa.' });
    }

    // Contoh: hitung tugas & materi untuk tiap mapel secara paralel
    const results = await Promise.all(mapelKrsList.map(async ({ mapel_id, krs_id }) => {
      const [[counts]] = await db.query(`
        SELECT 
          (SELECT COUNT(*) FROM tugas WHERE mapel_id = ? AND krs_id = ?) AS jumlah_tugas,
          (SELECT COUNT(*) FROM materi WHERE mapel_id = ? AND krs_id = ?) AS jumlah_materi
      `, [mapel_id, krs_id, mapel_id, krs_id]);

      return { mapel_id, jumlah_tugas: counts.jumlah_tugas, jumlah_materi: counts.jumlah_materi };
    }));

    res.status(200).json({
      status: 200,
      data: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil jumlah tugas dan materi.' });
  }
};


// GET nama mapel dan nama kelas
const getMapelKelas = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIS siswa berdasarkan userId
    const [siswaRows] = await db.query(
      'SELECT nis FROM siswa WHERE user_id = ?',
      [userId]
    );
    if (siswaRows.length === 0) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }
    const nis = siswaRows[0].nis;

    const [rows] = await db.query(`
    SELECT
      mp.mapel_id,
      kls.nama_kelas,
      mp.nama_mapel
    FROM krs
    JOIN kelas kls ON krs.kelas_id = kls.kelas_id
    JOIN krs_detail kd ON krs.krs_id = kd.krs_id
    JOIN mapel mp ON kd.mapel_id = mp.mapel_id
    WHERE krs.siswa_nis = ?
    GROUP BY kls.nama_kelas, mp.mapel_id, mp.nama_mapel
    ORDER BY kls.nama_kelas, mp.nama_mapel;
    `, [nis]);

    res.status(200).json({
      status: 200,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data mapel dan kelas.' });
  }
};

const getMateri = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID tidak ditemukan di JWT'
      });
    }

    // Pastikan siswa ada
    const [[siswa]] = await db.query(
      'SELECT nis FROM siswa WHERE user_id = ?',
      [userId]
    );
    if (!siswa) {
      return res.status(404).json({
        success: false,
        message: 'Data siswa tidak ditemukan'
      });
    }

    // Ambil materi yang diambil siswa
    const [materiQuery] = await db.query(`
      SELECT 
        m.materi_id,
        m.nama_materi,
        m.uraian,
        m.created_at,
        mp.nama_mapel,
        kls.nama_kelas
      FROM krs_detail_materi kdm
      JOIN materi m ON kdm.materi_id = m.materi_id
      JOIN mapel mp ON kdm.mapel_id = mp.mapel_id
      JOIN krs k ON kdm.krs_id = k.krs_id
      JOIN kelas kls ON k.kelas_id = kls.kelas_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE s.user_id = ?
    `, [userId]);

    res.status(200).json({
      success: true,
      data: materiQuery
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data materi',
      error: error.message
    });
  }
};


const getTugas = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    // Ambil NIS siswa dari userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }
    const nis = siswa.nis;

    // Ambil semua krs_id yang terkait dengan siswa tersebut
    const [krsList] = await db.query(`
      SELECT krs_id FROM krs WHERE siswa_nis = ?
    `, [nis]);

    if (krsList.length === 0) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak terdaftar di kelas manapun.' });
    }

    const krsIds = krsList.map(k => k.krs_id);

    // Query tugas melalui krs_detail_materi
    let query = `
      SELECT 
        t.tugas_id,
        t.judul AS nama_tugas,
        t.deskripsi,
        t.lampiran,
        t.tenggat_kumpul,
        t.created_at,
        mp.nama_mapel,
        kls.nama_kelas,
	kdm.uraian,
        kdm.file_jawaban,
        kdm.nilai,
        kdm.tanggal_pengumpulan
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id AND kdm.mapel_id = kd.mapel_id
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      JOIN krs kr ON kd.krs_id = kr.krs_id
      JOIN kelas kls ON kr.kelas_id = kls.kelas_id
      WHERE kd.mapel_id = ? AND kd.krs_id IN (?)
      ORDER BY t.tenggat_kumpul ASC
    `;

    const [tugasList] = await db.query(query, [mapel_id, krsIds]);

    res.status(200).json({
      status: 200,
      data: tugasList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data tugas.' });
  }
};
// GET materi detail
const getMateriDetail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { materi_id } = req.params; // ambil materi_id dari route param

    if (!materi_id) {
      return res.status(400).json({ status: 400, message: 'materi_id wajib diisi.' });
    }

    // Ambil nis siswa dari userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }
    const nis = siswa.nis;

    const [rows] = await db.query(`
      SELECT 
        mtr.materi_id,
        mtr.nama_materi,
        mtr.uraian,
        mtr.lampiran,
        mp.nama_mapel,
        mtr.created_at
      FROM materi mtr
      JOIN mapel mp ON mtr.mapel_id = mp.mapel_id
      JOIN krs ON mtr.krs_id = krs.krs_id
      WHERE mtr.materi_id = ? AND krs.siswa_nis = ?
      ORDER BY mtr.created_at DESC
    `, [materi_id, nis]);

    res.status(200).json({
      status: 200,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data materi.' });
  }
};

// GET tugas detail
const getTugasDetail = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tugas_id } = req.params; // ambil tugas_id dari route param

    if (!tugas_id) {
      return res.status(400).json({ status: 400, message: 'tugas_id wajib diisi.' });
    }

    // Ambil nis siswa dari userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ status: 404, message: 'Siswa tidak ditemukan.' });
    }
    const nis = siswa.nis;

    const [rows] = await db.query(`
      SELECT 
        tgs.tugas_id,
        tgs.judul,
        tgs.tenggat_kumpul,
        tgs.tanggal_pengumpulan,
        tgs.lampiran,
        mp.nama_mapel,
        tgs.created_at
      FROM tugas tgs
      JOIN mapel mp ON tgs.mapel_id = mp.mapel_id
      JOIN krs ON tgs.krs_id = krs.krs_id
      WHERE tgs.tugas_id = ? AND krs.siswa_nis = ?
      ORDER BY tgs.created_at DESC
    `, [tugas_id, nis]);

    res.status(200).json({
      status: 200,
      data: rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data tugas.' });
  }
};


module.exports = { 
  getMapelKelas, 
  getJumlahTugasMateri, 
  getMateri, 
  getTugas, 
  getMateriDetail, 
  getTugasDetail
};