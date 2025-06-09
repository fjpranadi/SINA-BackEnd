const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// CREATE - Tambah Tahun Akademik
// CREATE - Tambah Tahun Akademik
const tambahTahunAkademik = async (req, res) => {
  const { kurikulum_id, tahun_mulai, tahun_berakhir, status } = req.body;

  if (!kurikulum_id || !tahun_mulai || !tahun_berakhir || !status) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    // Check if kurikulum exists
    const [kurikulum] = await db.query(
      `SELECT * FROM kurikulum WHERE kurikulum_id = ?`, 
      [kurikulum_id]
    );

    if (kurikulum.length === 0) {
      return res.status(400).json({ message: 'Kurikulum tidak ditemukan.' });
    }

    const nama_kurikulum = kurikulum[0].nama_kurikulum;
    
    // Parse the dates
    const startDate = new Date(tahun_mulai);
    const endDate = new Date(tahun_berakhir);
    
    // Get the years and months
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth() + 1; // Months are 0-indexed
    
    // Determine academic year and semester
    let academicYear, semester;
    
    if (startMonth >= 8 || startMonth <= 1) {
      // August-January period (Semester 1 of current academic year)
      academicYear = startMonth <= 1 ? startYear - 1 : startYear;
      semester = 1;
    } else {
      // February-July period (Semester 2 of previous academic year)
      academicYear = startYear - 1;
      semester = 2;
    }
    
    // Generate the ID (academic year + semester)
    let tahunAkademikId = `${academicYear}${semester}`;
    
    // Check if ID already exists
    const [existing] = await db.query(
      `SELECT * FROM tahun_akademik WHERE tahun_akademik_id = ?`,
      [tahunAkademikId]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({
        message: 'Tahun akademik untuk semester ini sudah ada',
        existing_data: existing[0]
      });
    }

    // Insert new tahun akademik
    await db.query(
      `INSERT INTO tahun_akademik 
       (tahun_akademik_id, kurikulum_id, tahun_mulai, tahun_berakhir, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [tahunAkademikId, kurikulum_id, tahun_mulai, tahun_berakhir, status]
    );

    res.status(201).json({
      message: 'Tahun akademik berhasil ditambahkan.',
      data: {
        tahun_akademik_id: tahunAkademikId,
        kurikulum_id,
        nama_kurikulum,
        tahun_mulai,
        tahun_berakhir,
        status,
        academic_year: academicYear,
        semester: semester
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menambahkan tahun akademik.', 
      error: error.message 
    });
  }
};


// READ - Ambil Semua Tahun Akademik
const getAllTahunAkademik = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, k.nama_kurikulum 
       FROM tahun_akademik t 
       JOIN kurikulum k ON t.kurikulum_id = k.kurikulum_id 
       ORDER BY t.created_at DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data tahun akademik.' });
  }
};

// READ - Ambil Tahun Akademik by ID
const getTahunAkademikById = async (req, res) => {
  const { tahun_akademik_id } = req.params;

  try {
    const [rows] = await db.query(
      `SELECT t.*, k.nama_kurikulum 
       FROM tahun_akademik t 
       JOIN kurikulum k ON t.kurikulum_id = k.kurikulum_id 
       WHERE t.tahun_akademik_id = ?`,
      [tahun_akademik_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Tahun akademik tidak ditemukan.' });

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data tahun akademik.' });
  }
};

// UPDATE - Edit Tahun Akademik
const updateTahunAkademik = async (req, res) => {
  const { kurikulum_id, tahun_mulai, tahun_berakhir, status } = req.body;
  const { tahun_akademik_id } = req.params;

  if (!kurikulum_id || !tahun_mulai || !tahun_berakhir || !status) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    const [kurikulum] = await db.query(`SELECT * FROM kurikulum WHERE kurikulum_id = ?`, [kurikulum_id]);
    if (kurikulum.length === 0) {
      return res.status(400).json({ message: 'Kurikulum tidak ditemukan.' });
    }

    const nama_kurikulum = kurikulum[0].nama_kurikulum;

    await db.query(
      `UPDATE tahun_akademik 
       SET kurikulum_id = ?, tahun_mulai = ?, tahun_berakhir = ?, status = ? 
       WHERE tahun_akademik_id = ?`,
      [kurikulum_id, tahun_mulai, tahun_berakhir, status, tahun_akademik_id]
    );

    res.status(200).json({
      message: 'Tahun akademik berhasil diperbarui.',
      data: {
        tahun_akademik_id,
        kurikulum_id,
        nama_kurikulum,
        tahun_mulai,
        tahun_berakhir,
        status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui tahun akademik.', error: err.message });
  }
};

// DELETE - Hapus Tahun Akademik
const hapusTahunAkademik = async (req, res) => {
  const { tahun_akademik_id } = req.params;

  try {
    const [cek] = await db.query(`SELECT * FROM tahun_akademik WHERE tahun_akademik_id = ?`, [tahun_akademik_id]);
    if (cek.length === 0) return res.status(404).json({ message: 'Tahun akademik tidak ditemukan.' });

    await db.query(`DELETE FROM tahun_akademik WHERE tahun_akademik_id = ?`, [tahun_akademik_id]);

    res.status(200).json({ message: 'Tahun akademik berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus tahun akademik.', error: err.message });
  }
};

module.exports = {
  tambahTahunAkademik,
  getAllTahunAkademik,
  getTahunAkademikById,
  updateTahunAkademik,
  hapusTahunAkademik
};
