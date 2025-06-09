const db = require('../database/db');
const { v4: uuidv4 } = require('uuid'); // Diperlukan untuk generate kelas_id

// const jwt = require('jsonwebtoken'); // Tidak digunakan di kode ini
// const bcrypt = require('bcryptjs'); // Tidak digunakan di kode ini
// const crypto = require('crypto'); // Tidak digunakan di kode ini
// const JWT_SECRET = 'token-jwt'; // Tidak digunakan di kode ini
const { randomBytes } = require('crypto');

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
  // Pastikan input adalah string sebelum memanggil toLowerCase()
  if (typeof input !== 'string') {
    return false;
  }
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Kelas
const tambahKelas = async (req, res) => {
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  if (!tahun_akademik_id || !guru_nip || !nama_kelas || !tingkat || !jenjang) {
    return res.status(400).json({ message: 'Semua field (termasuk jenjang) wajib diisi!' });
  }

  // SQL Injection check
  const inputFields = [guru_nip, nama_kelas, tingkat.toString(), jenjang];
  for (let field of inputFields) {
    if (containsSQLInjection(field)) {
      return res.status(400).json({ message: 'Input mengandung kata terlarang (potensi SQL Injection).' });
    }
  }

  try {
    // Validate guru exists
    const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [guru_nip]);
    if (guruRows.length === 0) {
      return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan.' });
    }

    // Get kurikulum_id from tahun_akademik table
    const [tahunAkademikRows] = await db.query(
      'SELECT kurikulum_id FROM tahun_akademik WHERE tahun_akademik_id = ?', 
      [tahun_akademik_id]
    );

    if (tahunAkademikRows.length === 0) {
      return res.status(404).json({ message: 'Tahun akademik dengan ID tersebut tidak ditemukan.' });
    }

    const kurikulum_id = tahunAkademikRows[0].kurikulum_id;

    // Generate random ID and attempt insertion
    const MAX_ATTEMPTS = 5;
    let attempts = 0;
    let kelas_id;
    let inserted = false;

    while (attempts < MAX_ATTEMPTS && !inserted) {
      attempts++;
      
      // Generate 64-bit random number (BIGINT)
      kelas_id = randomBytes(8).readBigUInt64BE();
      
      try {
        await db.query(
          `INSERT INTO kelas 
           (kelas_id, tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [kelas_id, tahun_akademik_id, kurikulum_id, guru_nip, nama_kelas, tingkat, jenjang]
        );
        inserted = true;
      } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY' || attempts >= MAX_ATTEMPTS) {
          throw error;
        }
      }
    }

    if (!inserted) {
      throw new Error('Gagal menghasilkan ID unik setelah beberapa percobaan');
    }

    res.status(201).json({ 
      message: 'Kelas berhasil ditambahkan.',
      kelas_id: kelas_id.toString(),
      kurikulum_id: kurikulum_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menambahkan kelas.', 
      error: error.message 
    });
  }
};


// READ - Ambil Semua Kelas
const getAllKelas = async (req, res) => {
  try {
    // Panggil stored procedure admin_read_kelas dengan NULL untuk target_kelas_id dan tahun_akademik_id
    const [rows] = await db.query('CALL admin_read_kelas(NULL, NULL)');
    
    // rows[0] berisi data mentah dari stored procedure
    // Stored procedure admin_read_kelas mengembalikan:
    // k.kelas_id, k.nama_kelas, k.tingkat, g.nama_guru, k.jenjang, 
    // t.tahun_mulai, t.tahun_berakhir, k.created_at
    const kelasData = rows[0];

    res.status(200).json(kelasData); // Mengembalikan data mentah dari SP
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
  }
};

// READ - Ambil Kelas by ID
const getKelasById = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    // Panggil stored procedure admin_read_kelas dengan kelas_id dan NULL untuk tahun_akademik_id
    const [rows] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    const kelasData = rows[0]; 

    if (kelasData.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    // Mengembalikan data mentah objek pertama dari SP
    // Stored procedure admin_read_kelas mengembalikan:
    // k.kelas_id, k.nama_kelas, k.tingkat, g.nama_guru, k.jenjang, 
    // t.tahun_mulai, t.tahun_berakhir, k.created_at
    res.status(200).json(kelasData[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data kelas.', error: err.message });
  }
};

// UPDATE - Edit Kelas
const updateKelas = async (req, res) => {
  const { kelas_id } = req.params;
  const { tahun_akademik_id, guru_nip, nama_kelas, tingkat, jenjang } = req.body;

  try {
    // 1. Get current class data
    const [kelasRows] = await db.query('SELECT * FROM kelas WHERE kelas_id = ?', [kelas_id]);
    if (kelasRows.length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    const currentData = kelasRows[0];

    // 2. Prepare update data (gunakan nilai lama jika tidak disediakan)
    const updateData = {
      tahun_akademik_id: tahun_akademik_id || currentData.tahun_akademik_id,
      guru_nip: guru_nip || currentData.guru_nip,
      nama_kelas: nama_kelas || currentData.nama_kelas,
      tingkat: (tingkat !== undefined && tingkat !== null) ? String(tingkat) : currentData.tingkat,
      jenjang: jenjang || currentData.jenjang
    };

    // 3. Jika tahun_akademik_id diupdate, dapatkan kurikulum_id yang baru
    let kurikulum_id = currentData.kurikulum_id;
    if (tahun_akademik_id) {
      const [tahunAkademikRows] = await db.query(
        'SELECT kurikulum_id FROM tahun_akademik WHERE tahun_akademik_id = ?', 
        [updateData.tahun_akademik_id]
      );
      if (tahunAkademikRows.length === 0) {
        return res.status(404).json({ message: 'Tahun akademik dengan ID tersebut tidak ditemukan.' });
      }
      kurikulum_id = tahunAkademikRows[0].kurikulum_id;
    }

    // 4. Validasi guru jika guru_nip diupdate
    if (guru_nip && guru_nip !== currentData.guru_nip) {
      const [guruRows] = await db.query('SELECT * FROM guru WHERE nip = ?', [updateData.guru_nip]);
      if (guruRows.length === 0) {
        return res.status(404).json({ message: 'Guru dengan NIP tersebut tidak ditemukan.' });
      }
    }

    // 5. SQL Injection check hanya untuk field yang diupdate
    const fieldsToCheck = {};
    if (tahun_akademik_id) fieldsToCheck.tahun_akademik_id = updateData.tahun_akademik_id;
    if (guru_nip) fieldsToCheck.guru_nip = updateData.guru_nip;
    if (nama_kelas) fieldsToCheck.nama_kelas = updateData.nama_kelas;
    if (tingkat !== undefined) fieldsToCheck.tingkat = updateData.tingkat;
    if (jenjang) fieldsToCheck.jenjang = updateData.jenjang;

    for (const [field, value] of Object.entries(fieldsToCheck)) {
      if (containsSQLInjection(value)) {
        return res.status(400).json({ message: `Input ${field} mengandung kata terlarang.` });
      }
    }

    // 6. Check if any data actually changed
    const isSameData = 
      updateData.tahun_akademik_id === currentData.tahun_akademik_id &&
      kurikulum_id === currentData.kurikulum_id &&
      updateData.guru_nip === currentData.guru_nip &&
      updateData.nama_kelas === currentData.nama_kelas &&
      updateData.tingkat === currentData.tingkat &&
      updateData.jenjang === currentData.jenjang;

    if (isSameData) {
      return res.status(200).json({ 
        message: 'Tidak ada perubahan data.',
        data: currentData
      });
    }

    // 7. Update the class data
// Pada bagian query UPDATE, hapus updated_at
await db.query(
  `UPDATE kelas SET
    tahun_akademik_id = ?,
    kurikulum_id = ?,
    guru_nip = ?,
    nama_kelas = ?,
    tingkat = ?,
    jenjang = ?
  WHERE kelas_id = ?`,
  [
    updateData.tahun_akademik_id,
    kurikulum_id,
    updateData.guru_nip,
    updateData.nama_kelas,
    updateData.tingkat,
    updateData.jenjang,
    kelas_id
  ]
);

    res.status(200).json({ 
      message: 'Data kelas berhasil diupdate.',
      updated_data: {
        kelas_id,
        tahun_akademik_id: updateData.tahun_akademik_id,
        kurikulum_id,
        guru_nip: updateData.guru_nip,
        nama_kelas: updateData.nama_kelas,
        tingkat: updateData.tingkat,
        jenjang: updateData.jenjang
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal memperbarui data kelas.', 
      error: error.message 
    });
  }
};

// DELETE - Hapus Kelas
const hapusKelas = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    const [kelasExistResult] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    if (kelasExistResult[0].length === 0) {
        return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }

    const [siswaDiKelasResult] = await db.query(`CALL sp_read_siswa_from_kelas(?)`, [kelas_id]);
    const siswaDiKelas = siswaDiKelasResult[0];

    if (siswaDiKelas.length > 0) {
      return res.status(400).json({ message: `Tidak dapat menghapus kelas karena masih ada ${siswaDiKelas.length} siswa terdaftar di kelas ini.` });
    }

    await db.query('CALL admin_delete_kelas(?)', [kelas_id]);

    res.status(200).json({ message: 'Kelas berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menghapus kelas.', error: error.message });
  }
};

// GET - Ambil semua siswa berdasarkan kelas_id
const getSiswaByKelasId = async (req, res) => {
  const { kelas_id } = req.params;

  try {
    const [kelasInfoResult] = await db.query('CALL admin_read_kelas(?, NULL)', [kelas_id]);
    if (kelasInfoResult[0].length === 0) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan.' });
    }
    // Mengembalikan data mentah info kelas dari SP admin_read_kelas
    const kelasInfoData = kelasInfoResult[0][0]; 

    const [siswaResult] = await db.query('CALL sp_read_siswa_from_kelas(?)', [kelas_id]);
    const siswaData = siswaResult[0]; 

    // SP sp_read_siswa_from_kelas mengembalikan: 
    // s.nama_siswa, s.foto_profil, s.nis, s.nisn, s.jenis_kelamin, s.created_at
    // Ini akan dikembalikan apa adanya.

    if (siswaData.length === 0) {
      return res.status(200).json({ 
        message: 'Tidak ada siswa di kelas ini.',
        kelas_info: kelasInfoData, // Mengembalikan data mentah kelas info
        siswa: [] 
      });
    }
    
    res.status(200).json({
      kelas_info: kelasInfoData, // Mengembalikan data mentah kelas info
      siswa: siswaData 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data siswa berdasarkan kelas.', error: error.message });
  }
};


module.exports = {
  tambahKelas,
  getAllKelas,
  getKelasById,
  updateKelas,
  hapusKelas,
  getSiswaByKelasId
};
