const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';

const getMapelKelasGuru = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [rows] = await db.query(`
      SELECT 
        kd.krs_id,
        kd.mapel_id,
        mp.nama_mapel,
        kls.kelas_id,
        kls.nama_kelas
      FROM krs_detail kd
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      JOIN krs ON kd.krs_id = krs.krs_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      WHERE kd.guru_nip = ?
      GROUP BY kd.krs_id, kd.mapel_id, mp.nama_mapel, kls.kelas_id, kls.nama_kelas
      ORDER BY kls.nama_kelas, mp.nama_mapel
    `, [guru.nip]);

    res.status(200).json({
      status: 200,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data mapel dan kelas berdasarkan krs_detail.' });
  }
};

const getTugasGuruByMapel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [rows] = await db.query(`
      SELECT 
        tgs.tugas_id,
        tgs.judul AS nama_tugas,
        tgs.tenggat_kumpul,
        tgs.tanggal_pengumpulan,
        tgs.created_at,
        mp.mapel_id,
        mp.nama_mapel,
        kls.kelas_id,
        kls.nama_kelas
      FROM tugas tgs
      JOIN krs ON tgs.krs_id = krs.krs_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = tgs.mapel_id
      JOIN mapel mp ON tgs.mapel_id = mp.mapel_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      WHERE kd.guru_nip = ? AND kd.mapel_id = ?
      ORDER BY tgs.created_at DESC
    `, [guru.nip, mapel_id]);

    res.status(200).json({
      status: 200,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data tugas.' });
  }
};

const getMateriGuruByMapel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [rows] = await db.query(`
      SELECT 
        mtr.materi_id,
        mtr.nama_materi,
        mtr.created_at,
        mp.mapel_id,
        mp.nama_mapel,
        kls.kelas_id,
        kls.nama_kelas
      FROM materi mtr
      JOIN krs ON mtr.krs_id = krs.krs_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = mtr.mapel_id
      JOIN mapel mp ON mtr.mapel_id = mp.mapel_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      WHERE kd.guru_nip = ? AND kd.mapel_id = ?
      ORDER BY mtr.created_at DESC
    `, [guru.nip, mapel_id]);

    res.status(200).json({
      status: 200,
      data: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil data materi.' });
  }
};

const getTugasDetailById = async (req, res) => {
  try {
    const { tugas_id } = req.params;
    const userId = req.user.userId;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [[tugas]] = await db.query(`
      SELECT 
        tgs.tugas_id,
        tgs.judul AS nama_tugas,
        tgs.deskripsi,
        tgs.lampiran,
        tgs.uraian,
        tgs.tenggat_kumpul,
        tgs.tanggal_pengumpulan,
        tgs.created_at,
        mp.mapel_id,
        mp.nama_mapel,
        kls.kelas_id,
        kls.nama_kelas
      FROM tugas tgs
      JOIN mapel mp ON tgs.mapel_id = mp.mapel_id
      JOIN krs ON tgs.krs_id = krs.krs_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = tgs.mapel_id
      WHERE tgs.tugas_id = ? AND kd.guru_nip = ?
    `, [tugas_id, guru.nip]);

    if (!tugas) {
      return res.status(404).json({ status: 404, message: 'Tugas tidak ditemukan.' });
    }

    res.status(200).json({ status: 200, data: tugas });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil detail tugas.' });
  }
};

const getMateriDetailById = async (req, res) => {
  try {
    const { materi_id } = req.params;
    const userId = req.user.userId;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [[materi]] = await db.query(`
      SELECT 
        mtr.materi_id,
        mtr.nama_materi,
        mtr.lampiran,
        mtr.uraian,
        mtr.created_at,
        mp.mapel_id,
        mp.nama_mapel,
        kls.kelas_id,
        kls.nama_kelas
      FROM materi mtr
      JOIN mapel mp ON mtr.mapel_id = mp.mapel_id
      JOIN krs ON mtr.krs_id = krs.krs_id
      JOIN kelas kls ON krs.kelas_id = kls.kelas_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = mtr.mapel_id
      WHERE mtr.materi_id = ? AND kd.guru_nip = ?
    `, [materi_id, guru.nip]);

    if (!materi) {
      return res.status(404).json({ status: 404, message: 'Materi tidak ditemukan.' });
    }

    res.status(200).json({ status: 200, data: materi });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal mengambil detail materi.' });
  }
};

const updateTugasById = async (req, res) => {
  try {
    const { tugas_id } = req.params;
    const userId = req.user.userId;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [[existing]] = await db.query(`
      SELECT tgs.*
      FROM tugas tgs
      JOIN krs ON tgs.krs_id = krs.krs_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = tgs.mapel_id
      WHERE tgs.tugas_id = ? AND kd.guru_nip = ?
    `, [tugas_id, guru.nip]);

    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Tugas tidak ditemukan atau bukan milik Anda.' });
    }

    const {
      judul = existing.judul,
      deskripsi = existing.deskripsi,
      tenggat_kumpul = existing.tenggat_kumpul,
      tanggal_pengumpulan = existing.tanggal_pengumpulan,
      lampiran = existing.lampiran,
      uraian = existing.uraian
    } = req.body;

    await db.query(`
      UPDATE tugas 
      SET judul = ?, deskripsi = ?, tenggat_kumpul = ?, tanggal_pengumpulan = ?, lampiran = ?, uraian = ?, updated_at = NOW()
      WHERE tugas_id = ?
    `, [judul, deskripsi, tenggat_kumpul, tanggal_pengumpulan, lampiran, uraian, tugas_id]);

    res.status(200).json({ status: 200, message: 'Tugas berhasil diperbarui.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal memperbarui tugas.' });
  }
};

const updateMateriById = async (req, res) => {
  try {
    const { materi_id } = req.params;
    const userId = req.user.userId;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [[existing]] = await db.query(`
      SELECT mtr.*
      FROM materi mtr
      JOIN krs ON mtr.krs_id = krs.krs_id
      JOIN krs_detail kd ON kd.krs_id = krs.krs_id AND kd.mapel_id = mtr.mapel_id
      WHERE mtr.materi_id = ? AND kd.guru_nip = ?
    `, [materi_id, guru.nip]);

    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Materi tidak ditemukan atau bukan milik Anda.' });
    }

    const {
      judul = existing.judul,
      deskripsi = existing.deskripsi,
      tanggal_upload = existing.tanggal_upload,
      lampiran = existing.lampiran,
      uraian = existing.uraian
    } = req.body;

    await db.query(`
      UPDATE materi 
      SET judul = ?, deskripsi = ?, tanggal_upload = ?, lampiran = ?, uraian = ?, updated_at = NOW()
      WHERE materi_id = ?
    `, [judul, deskripsi, tanggal_upload, lampiran, uraian, materi_id]);

    res.status(200).json({ status: 200, message: 'Materi berhasil diperbarui.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal memperbarui materi.' });
  }
};

const postTugas = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      judul,
      deskripsi,
      tenggat_kumpul,
      tanggal_pengumpulan,
      mapel_id,
      kelas_id
    } = req.body;

    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ status: 404, message: 'Guru tidak ditemukan.' });
    }

    const [[valid]] = await db.query(`
      SELECT kd.krs_id
      FROM krs_detail kd
      JOIN krs ON kd.krs_id = krs.krs_id
      WHERE kd.guru_nip = ? AND kd.mapel_id = ? AND krs.kelas_id = ?
    `, [guru.nip, mapel_id, kelas_id]);

    if (!valid) {
      return res.status(403).json({ status: 403, message: 'Anda tidak memiliki akses ke mapel dan kelas ini.' });
    }

    let lampiran = null;
    if (req.file) {
      lampiran = req.file.filename;
    }

    await db.query(`
      INSERT INTO tugas (judul, deskripsi, tenggat_kumpul, tanggal_pengumpulan, lampiran, mapel_id, krs_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [judul, deskripsi, tenggat_kumpul, tanggal_pengumpulan, lampiran, mapel_id, valid.krs_id]);

    res.status(201).json({ status: 201, message: 'Tugas berhasil ditambahkan.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, message: 'Gagal menambahkan tugas.' });
  }
};

module.exports = {
  getMapelKelasGuru,
  getTugasGuruByMapel,
  getMateriGuruByMapel,
  getTugasDetailById,
  getMateriDetailById,
  updateTugasById,
  updateMateriById,
  postTugas
};
