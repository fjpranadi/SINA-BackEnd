const db = require('../database/db');
const jwt = require('jsonwebtoken');
const path = require('path');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const getdashboard = async (req, res) => {
  try {
    // Get userId from JWT token
    const userId = req.user.userId;

    // Ambil NIP guru berdasarkan userId
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // 1. Hitung tugas yang belum dikumpulkan oleh siswa
    const [uncompletedTasks] = await db.query(`
      SELECT COUNT(DISTINCT t.tugas_id) as count
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kd.guru_nip = ? 
      AND kdm.tanggal_pengumpulan IS NULL
      AND t.tenggat_kumpul >= NOW()
    `, [guru_nip]);

    // 2. Hitung siswa yang absen hari ini
    const [absentStudents] = await db.query(`
      SELECT COUNT(DISTINCT a.krs_id) as count
      FROM absensi a
      JOIN krs_detail kd ON a.krs_id = kd.krs_id
      WHERE a.guru_nip = ?
      AND a.keterangan = 'a'
      AND DATE(a.tanggal) = DATE(NOW())
    `, [guru_nip]);

    // 3. Hitung keterlambatan pengumpulan tugas
    const [lateSubmissions] = await db.query(`
      SELECT COUNT(DISTINCT kdm.krs_id) as count
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kd.guru_nip = ?
      AND kdm.tanggal_pengumpulan > t.tenggat_kumpul
    `, [guru_nip]);

    // 4. Hitung materi yang diposting hari ini
    const [todayMaterials] = await db.query(`
      SELECT COUNT(DISTINCT m.materi_id) as count
      FROM materi m
      JOIN krs_detail_materi kdm ON m.materi_id = kdm.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kd.guru_nip = ?
      AND DATE(m.created_at) = DATE(NOW())
    `, [guru_nip]);

    // Siapkan data dashboard
    const dashboardData = {
      uncompleted_tasks: uncompletedTasks.count || 0,
      absent_students: absentStudents.count || 0,
      late_submissions: lateSubmissions.count || 0,
      today_materials: todayMaterials.count || 0
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};




const getJadwalGuru = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Ambil NIP guru berdasarkan userId
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    const [jadwalGuru] = await db.query(`
      SELECT 
        mj.jam_ke,
        mj.start,
        mj.finish,
        j.hari,
        m.nama_mapel,
        k.nama_kelas
      FROM krs_detail kd
      JOIN krs krs ON kd.krs_id = krs.krs_id
      JOIN jadwal j ON kd.mapel_id = j.mapel_id AND krs.kelas_id = j.kelas_id
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      WHERE kd.guru_nip = ?
      GROUP BY mj.jam_ke, mj.start, mj.finish, j.hari, m.nama_mapel, k.nama_kelas
      ORDER BY j.hari, mj.jam_ke
    `, [guru_nip]);

    res.status(200).json({
      success: true,
      data: jadwalGuru
    });
  } catch (error) {
    console.error('Error fetching jadwal guru:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil jadwal guru'
    });
  }
};


const getSiswaByKelasGuru = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    if (!mapel_id) {
      return res.status(400).json({
        success: false,
        message: 'mapel_id diperlukan sebagai parameter'
      });
    }

    // Ambil NIP guru berdasarkan userId
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // Panggil stored procedure
    const [results, metadata] = await db.query(
      `CALL sp_get_siswa_by_kelas_guru(?, ?)`,
      [guru_nip, mapel_id]
    );

    console.log('Raw results from SP:', results); // Debugging

    // Proses hasil dari stored procedure
    const data = Array.isArray(results[0]) ? results[0] : results;

    // Jika hasil pertama adalah pesan error
    if (data[0] && data[0].status === 'error') {
      return res.status(403).json({
        success: false,
        message: data[0].message
      });
    }

    // Ambil daftar siswa dengan status 'success'
    const siswaList = data
      .filter(item => item.status === 'success')
      .map(item => ({ nama: item.nama }));

    res.status(200).json({
      success: true,
      data: siswaList
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
};

const getMapelGuru = async (req, res) => {
  try {
    // 1. Ambil userId dari JWT (asumsi sudah dalam bentuk string tanpa perlu trim)
    const userId = req.user.userId;

    // 2. Debug: Log nilai yang akan digunakan dalam query
    console.log(`Mencari guru dengan userId: "${userId}"`);

    // 3. Query dengan parameterized query dan TRIM untuk memastikan
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE TRIM(user_id) = ?`,
      [userId]
    );

    // 4. Debug: Hasil query
    console.log('Hasil query guru:', teacher);

    if (!teacher.length) {
      // 5. Jika tidak ditemukan, cari kemungkinan masalah
      const [allUsers] = await db.query(
        `SELECT user_id, nip, nama_guru FROM guru 
         WHERE user_id LIKE '%${userId}%' 
         OR CAST(user_id AS CHAR) LIKE '%${userId}%' 
         LIMIT 5`
      );

      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan',
        debug: {
          user_id_dari_jwt: userId,
          kemungkinan_data_guru: allUsers,
          tipe_data_di_database: 'VARCHAR(50)',
          query_yang_digunakan: `SELECT nip FROM guru WHERE TRIM(user_id) = '${userId}'`
        }
      });
    }

    const guru_nip = teacher[0].nip;
    console.log(`Guru ditemukan dengan NIP: ${guru_nip}`);

    // 6. Query untuk mata pelajaran
    const [mapelList] = await db.query(`
      SELECT 
        m.mapel_id,
        m.nama_mapel,
        m.kkm,
        COUNT(DISTINCT kd.krs_id) as jumlah_siswa
      FROM krs_detail kd
      INNER JOIN mapel m ON TRIM(kd.mapel_id) = TRIM(m.mapel_id)
      WHERE TRIM(kd.guru_nip) = ?
      GROUP BY m.mapel_id, m.nama_mapel, m.kkm
      ORDER BY m.nama_mapel
    `, [guru_nip]);

    // (respon yang dikembalikan ke client ditambahkan di sini jika ada)
    res.json({
      success: true,
      data: mapelList
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

const createTugasForSiswa = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;
    const { judul, deskripsi, tenggat_kumpul } = req.body; // kelas_id dihapus

    // Validasi input (tanpa kelas_id)
    if (!mapel_id || !judul || !deskripsi || !tenggat_kumpul) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi (judul, deskripsi, tenggat_kumpul)'
      });
    }

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Data guru tidak ditemukan' });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi sederhana - hanya cek apakah guru mengajar mapel ini
    const [mapelCheck] = await db.query(
      `SELECT 1 FROM krs_detail WHERE guru_nip = ? AND mapel_id = ? LIMIT 1`,
      [guru_nip, mapel_id]
    );

    if (!mapelCheck.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Anda tidak mengajar mapel ini'
      });
    }

    // Generate tugas_id
    const tugas_id = uuidv4();
    const lampiran = req.file ? req.file.filename : null;

    // Insert ke tabel tugas (tanpa kelas_id)
    await db.query(`
      INSERT INTO tugas (
        tugas_id, 
        judul, 
        deskripsi, 
        lampiran, 
        tenggat_kumpul, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())
    `, [tugas_id, judul, deskripsi, lampiran, tenggat_kumpul]);

    // Ambil siswa yang mengambil mapel ini (tanpa filter kelas)
    const [siswaList] = await db.query(`
      SELECT kd.krs_id 
      FROM krs_detail kd
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
    `, [mapel_id, guru_nip]);

    if (!siswaList.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Tidak ada siswa yang mengambil mapel ini'
      });
    }

    // Insert ke krs_detail_materi untuk setiap siswa
    for (const siswa of siswaList) {
      const kdm_id = uuidv4();
      await db.query(`
        INSERT INTO krs_detail_materi (
          kdm_id,
          krs_id,
          mapel_id,
          tugas_id,
          created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `, [kdm_id, siswa.krs_id, mapel_id, tugas_id]);
    }

    res.status(201).json({
      success: true,
      message: 'Tugas berhasil dibuat',
      data: {
        tugas_id,
        jumlah_siswa: siswaList.length,
        lampiran
      }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const updateTugasById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tugas_id } = req.params;
    const { judul, deskripsi, tenggat_kumpul } = req.body;
    const lampiran = req.file ? req.file.filename : null;

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi tugas milik guru
    const [check] = await db.query(`
      SELECT t.lampiran
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE t.tugas_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [tugas_id, guru_nip]);

    if (!check.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ success: false, message: 'Tugas tidak ditemukan atau Anda tidak memiliki akses' });
    }

    // Hapus lampiran lama jika ada dan diganti
    if (lampiran && check[0].lampiran) {
      const oldPath = path.join(__dirname, '../../express-admin/Upload/profile_image', check[0].lampiran);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Bangun query update
    const fields = [];
    const values = [];

    if (judul) {
      fields.push('judul = ?');
      values.push(judul);
    }
    if (deskripsi) {
      fields.push('deskripsi = ?');
      values.push(deskripsi);
    }
    if (tenggat_kumpul) {
      fields.push('tenggat_kumpul = ?');
      values.push(tenggat_kumpul);
    }
    if (lampiran) {
      fields.push('lampiran = ?');
      values.push(lampiran);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diperbarui' });
    }

    values.push(tugas_id);

    await db.query(`UPDATE tugas SET ${fields.join(', ')} WHERE tugas_id = ?`, values);

    res.status(200).json({
      success: true,
      message: 'Tugas berhasil diperbarui',
      data: { tugas_id, updated_fields: fields }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error update tugas:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui tugas',
      error: error.message
    });
  }
};

const deleteTugasById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tugas_id } = req.params;

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    }

    const guru_nip = teacher[0].nip;

    // Cek apakah guru punya akses ke tugas ini
    const [result] = await db.query(`
      SELECT t.lampiran
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE t.tugas_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [tugas_id, guru_nip]);

    if (!result.length) {
      return res.status(403).json({ success: false, message: 'Tugas tidak ditemukan atau tidak memiliki akses' });
    }

    const lampiran = result[0].lampiran;
    if (lampiran) {
      const lampiranPath = path.join(__dirname, '../../express-admin/Upload/profile_image', lampiran);
      if (fs.existsSync(lampiranPath)) {
        fs.unlinkSync(lampiranPath);
      }
    }

    // Hapus tugas dari tabel
    await db.query(`DELETE FROM tugas WHERE tugas_id = ?`, [tugas_id]);

    res.status(200).json({
      success: true,
      message: 'Tugas berhasil dihapus',
      data: {
        tugas_id,
        deleted_lampiran: lampiran ? true : false
      }
    });

  } catch (error) {
    console.error('Error delete tugas:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus tugas',
      error: error.message
    });
  }
};


const createMateriForSiswa = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;
    const { nama_materi, uraian } = req.body;

    // Validasi input
    if (!nama_materi || !uraian) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Nama materi dan uraian wajib diisi'
      });
    }

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        message: 'Data guru tidak ditemukan' 
      });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi guru mengajar mapel ini
    const [mapelCheck] = await db.query(
      `SELECT 1 FROM krs_detail WHERE guru_nip = ? AND mapel_id = ? LIMIT 1`,
      [guru_nip, mapel_id]
    );

    if (!mapelCheck.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Anda tidak mengajar mapel ini'
      });
    }

    // Generate materi_id dan simpan lampiran
    const materi_id = uuidv4();
    const lampiran = req.file ? req.file.filename : null;

    // Insert ke tabel materi (tanpa kelas_id)
    await db.query(`
      INSERT INTO materi (
        materi_id,
        nama_materi,
        uraian,
        lampiran,
        created_at
      ) VALUES (?, ?, ?, ?, NOW())
    `, [materi_id, nama_materi, uraian, lampiran]);

    // Ambil siswa yang mengambil mapel ini
    const [siswaList] = await db.query(`
      SELECT kd.krs_id 
      FROM krs_detail kd
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
    `, [mapel_id, guru_nip]);

    // Insert ke krs_detail_materi untuk setiap siswa
    for (const siswa of siswaList) {
      const kdm_id = uuidv4();
      await db.query(`
        INSERT INTO krs_detail_materi (
          kdm_id,
          krs_id,
          mapel_id,
          materi_id,
          created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `, [kdm_id, siswa.krs_id, mapel_id, materi_id]);
    }

    res.status(201).json({
      success: true,
      message: 'Materi berhasil dibuat',
      data: {
        materi_id,
        jumlah_siswa: siswaList.length,
        lampiran
      }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const updateMateriById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { materi_id } = req.params;
    const { nama_materi, uraian } = req.body;
    const lampiran = req.file ? req.file.filename : null;

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Guru tidak ditemukan'
      });
    }

    const guru_nip = teacher[0].nip;

    // Cek apakah guru berhak mengubah materi
    const [check] = await db.query(`
      SELECT m.lampiran
      FROM materi m
      JOIN krs_detail_materi kdm ON m.materi_id = kdm.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE m.materi_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [materi_id, guru_nip]);

    if (!check.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({
        success: false,
        message: 'Materi tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    // Hapus lampiran lama jika ada dan diganti
    if (lampiran && check[0].lampiran) {
      const oldPath = path.join(__dirname, '../../express-admin/Upload/profile_image', check[0].lampiran);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Siapkan query update
    const updateFields = [];
    const updateValues = [];

    if (nama_materi) {
      updateFields.push('nama_materi = ?');
      updateValues.push(nama_materi);
    }
    if (uraian) {
      updateFields.push('uraian = ?');
      updateValues.push(uraian);
    }
    if (lampiran) {
      updateFields.push('lampiran = ?');
      updateValues.push(lampiran);
    }

    if (!updateFields.length) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu field harus diisi'
      });
    }

    updateValues.push(materi_id);

    await db.query(`
      UPDATE materi 
      SET ${updateFields.join(', ')}
      WHERE materi_id = ?
    `, updateValues);

    res.status(200).json({
      success: true,
      message: 'Materi berhasil diperbarui',
      data: {
        materi_id,
        updated_fields: updateFields
      }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error update materi:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui materi',
      error: error.message
    });
  }
};

const deleteMateriById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { materi_id } = req.params;

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi materi milik guru
    const [check] = await db.query(`
      SELECT m.lampiran
      FROM materi m
      JOIN krs_detail_materi kdm ON m.materi_id = kdm.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE m.materi_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [materi_id, guru_nip]);

    if (!check.length) {
      return res.status(403).json({
        success: false,
        message: 'Materi tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    // Hapus file jika ada
    const lampiran = check[0].lampiran;
    if (lampiran) {
      const filePath = path.join(__dirname, '../../express-admin/Upload/profile_image', lampiran);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Hapus dari tabel materi
    await db.query(`DELETE FROM materi WHERE materi_id = ?`, [materi_id]);

    res.status(200).json({
      success: true,
      message: 'Materi berhasil dihapus',
      data: {
        materi_id,
        deleted_lampiran: !!lampiran
      }
    });

  } catch (error) {
    console.error('Error delete materi:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus materi',
      error: error.message
    });
  }
};


// Add these functions to your dashboardController.js

const getTugasGuruByMapel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    // Get teacher NIP
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // Verify the teacher teaches this subject
    const [mapelCheck] = await db.query(
      `SELECT 1 FROM krs_detail WHERE guru_nip = ? AND mapel_id = ? LIMIT 1`,
      [guru_nip, mapel_id]
    );

    if (!mapelCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not teaching this subject'
      });
    }

    // Get assignments for this subject
    const [tugasList] = await db.query(`
      SELECT 
        t.tugas_id,
        t.judul,
        t.deskripsi,
        t.lampiran,
        t.tenggat_kumpul,
        t.created_at,
        COUNT(kdm.kdm_id) as jumlah_siswa,
        SUM(CASE WHEN kdm.tanggal_pengumpulan IS NOT NULL THEN 1 ELSE 0 END) as jumlah_dikumpulkan,
        SUM(CASE WHEN kdm.tanggal_pengumpulan > t.tenggat_kumpul THEN 1 ELSE 0 END) as jumlah_terlambat
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
      GROUP BY t.tugas_id, t.judul, t.deskripsi, t.lampiran, t.tenggat_kumpul, t.created_at
      ORDER BY t.created_at DESC
    `, [mapel_id, guru_nip]);

    res.status(200).json({
      success: true,
      data: tugasList
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getMateriGuruByMapel = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;

    // Get teacher NIP
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // Verify the teacher teaches this subject
    const [mapelCheck] = await db.query(
      `SELECT 1 FROM krs_detail WHERE guru_nip = ? AND mapel_id = ? LIMIT 1`,
      [guru_nip, mapel_id]
    );

    if (!mapelCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'You are not teaching this subject'
      });
    }

    // Get materials for this subject
    const [materiList] = await db.query(`
      SELECT 
        m.materi_id,
        m.nama_materi,
        m.uraian,
        m.lampiran,
        m.created_at,
        COUNT(DISTINCT kdm.krs_id) as jumlah_siswa
      FROM materi m
      JOIN krs_detail_materi kdm ON m.materi_id = kdm.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
      GROUP BY m.materi_id, m.nama_materi, m.uraian, m.lampiran, m.created_at
      ORDER BY m.created_at DESC
    `, [mapel_id, guru_nip]);

    res.status(200).json({
      success: true,
      data: materiList
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getTugasDetailById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { tugas_id } = req.params;

    // Get teacher NIP
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // Get assignment details
    const [tugasDetail] = await db.query(`
      SELECT 
        t.tugas_id,
        t.judul,
        t.deskripsi,
        t.lampiran,
        t.tenggat_kumpul,
        t.created_at,
        m.nama_mapel
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      WHERE t.tugas_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [tugas_id, guru_nip]);

    if (!tugasDetail.length) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or you are not authorized'
      });
    }

    // Get students who have submitted
    const [siswaPengumpulan] = await db.query(`
      SELECT 
        s.nama_siswa,
        kdm.tanggal_pengumpulan,
        kdm.nilai,
        CASE 
          WHEN kdm.tanggal_pengumpulan > t.tenggat_kumpul THEN 'Terlambat'
          ELSE 'Tepat Waktu'
        END as status_pengumpulan
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.nis = s.nis
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      WHERE kdm.tugas_id = ?
      AND kd.guru_nip = ?
      AND kdm.tanggal_pengumpulan IS NOT NULL
      ORDER BY kdm.tanggal_pengumpulan DESC
    `, [tugas_id, guru_nip]);

    // Get students who haven't submitted
    const [siswaBelumMengumpulkan] = await db.query(`
      SELECT 
        s.nama_siswa
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.nis = s.nis
      WHERE kdm.tugas_id = ?
      AND kd.guru_nip = ?
      AND kdm.tanggal_pengumpulan IS NULL
      ORDER BY s.nama_siswa
    `, [tugas_id, guru_nip]);

    res.status(200).json({
      success: true,
      data: {
        detail: tugasDetail[0],
        siswa_pengumpulan: siswaPengumpulan,
        siswa_belum_mengumpulkan: siswaBelumMengumpulkan
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getMateriDetailById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { materi_id } = req.params;

    // Get teacher NIP
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Teacher data not found'
      });
    }

    const guru_nip = teacher[0].nip;

    // Get material details
    const [materiDetail] = await db.query(`
      SELECT 
        m.materi_id,
        m.nama_materi,
        m.uraian,
        m.lampiran,
        m.created_at,
        mp.nama_mapel
      FROM materi m
      JOIN krs_detail_materi kdm ON m.materi_id = kdm.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      WHERE m.materi_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [materi_id, guru_nip]);

    if (!materiDetail.length) {
      return res.status(404).json({
        success: false,
        message: 'Material not found or you are not authorized'
      });
    }

    // Get students who have access to this material
    const [siswaList] = await db.query(`
      SELECT 
        s.nama_siswa,
        k.nama_kelas
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.nis = s.nis
      JOIN kelas kl ON k.kelas_id = kl.kelas_id
      WHERE kdm.materi_id = ?
      AND kd.guru_nip = ?
      ORDER BY s.nama_siswa
    `, [materi_id, guru_nip]);

    res.status(200).json({
      success: true,
      data: {
        detail: materiDetail[0],
        siswa_list: siswaList
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

const getAbsensiByJadwal = async (req, res) => {
  const userId = req.user.userId;
  const { jadwal_id } = req.params;

  try {
    // Ambil NIP guru dari user
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    }

    const guru_nip = guru.nip;

    // Validasi apakah jadwal ini memang milik guru tersebut
    const [[jadwal]] = await db.query(`
      SELECT j.*
      FROM jadwal j
      JOIN krs_detail kd ON kd.mapel_id = j.mapel_id
      JOIN krs k ON kd.krs_id = k.krs_id AND k.kelas_id = j.kelas_id
      WHERE j.jadwal_id = ? AND kd.guru_nip = ?
      LIMIT 1
    `, [jadwal_id, guru_nip]);

    if (!jadwal) {
      return res.status(403).json({
        success: false,
        message: 'Jadwal tidak ditemukan atau bukan milik Anda'
      });
    }

    const [absensiList] = await db.query(`
      SELECT
        s.nama_siswa,
        s.nis,
        a.keterangan,
        a.uraian,
        DATE(a.tanggal) AS tanggal
      FROM absensi a
      JOIN krs_detail kd ON a.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE a.jadwal_id = ?
      GROUP BY s.nama_siswa, s.nis, a.keterangan, a.uraian, tanggal
      ORDER BY tanggal DESC
    `, [jadwal_id]);

    res.status(200).json({
      success: true,
      data: absensiList
    });

  } catch (error) {
    console.error('Error getAbsensiByJadwal:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data absensi',
      error: error.message
    });
  }
};

const createAbsensiSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { jadwal_id } = req.params;
  const { absensiData } = req.body;
  const tanggal = new Date();

  try {
    // Ambil NIP guru
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [userId]);
    if (!guru) {
      return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });
    }
    const guru_nip = guru.nip;

    // Validasi apakah guru memang mengajar jadwal ini
    const [[jadwal]] = await db.query(`
      SELECT j.*
      FROM jadwal j
      JOIN krs_detail kd ON kd.mapel_id = j.mapel_id
      JOIN krs k ON kd.krs_id = k.krs_id AND k.kelas_id = j.kelas_id
      WHERE j.jadwal_id = ? AND kd.guru_nip = ?
      LIMIT 1
    `, [jadwal_id, guru_nip]);

    if (!jadwal) {
      return res.status(403).json({
        success: false,
        message: 'Jadwal tidak ditemukan atau bukan milik Anda'
      });
    }

    // Cek dan siapkan data absensi (hindari duplikat)
    const absensiRecords = [];

    for (const item of absensiData) {
      const [existing] = await db.query(`
        SELECT 1 FROM absensi 
        WHERE jadwal_id = ? AND krs_id = ? AND DATE(tanggal) = CURDATE()
      `, [jadwal_id, item.krs_id]);

      if (existing.length > 0) {
        continue; // skip jika sudah absen hari ini
      }

      absensiRecords.push([
        uuidv4(),
        jadwal_id,
        item.krs_id,
        guru_nip,
        item.keterangan,
        tanggal,
        item.uraian || '',
        null, // surat
        new Date()
      ]);
    }

    // Insert absensi jika ada data valid
    if (absensiRecords.length > 0) {
      await db.query(`
        INSERT INTO absensi (
          absensi_id,
          jadwal_id,
          krs_id,
          guru_nip,
          keterangan,
          tanggal,
          uraian,
          surat,
          created_at
        ) VALUES ?
      `, [absensiRecords]);
    }

    res.status(201).json({
      success: true,
      message: 'Absensi berhasil dicatat',
      jumlah_dicatat: absensiRecords.length
    });

  } catch (error) {
    console.error('Error createAbsensiSiswa:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mencatat absensi',
      error: error.message
    });
  }
};

const getRingkasanDashboardGuru = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Ambil NIP guru
    const [[guru]] = await db.query(`
      SELECT nip FROM db_cina.guru WHERE user_id = ?
    `, [userId]);
    if (!guru) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });

    const guruNip = guru.nip;
    const currentTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS

    // Cek jadwal mengajar berdasarkan waktu dan kelas yang diasuh
    const [mengajar] = await db.query(`
      SELECT m.nama_mapel, k.kelas_id, k.nama_kelas
      FROM db_cina.jadwal j
      JOIN db_cina.master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN db_cina.mapel m ON j.mapel_id = m.mapel_id
      JOIN db_cina.kelas k ON j.kelas_id = k.kelas_id
      WHERE k.guru_nip = ?
        AND LOWER(j.hari) = LOWER(DAYNAME(CURDATE()))
        AND TIME(mj.start) <= ?
        AND TIME(mj.finish) >= ?
      LIMIT 1
    `, [guruNip, currentTime, currentTime]);

    // Ambil kelas yang dibina sebagai wali kelas
    const [[wali]] = await db.query(`
      SELECT kelas_id, nama_kelas FROM db_cina.kelas WHERE guru_nip = ?
    `, [guruNip]);

    // Tugas belum dikerjakan (semua kelas guru)
    const [[tugasBelum]] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM db_cina.krs_detail_materi d
      JOIN db_cina.materi m ON d.materi_id = m.materi_id
      JOIN db_cina.krs k ON d.krs_id = k.krs_id
      JOIN db_cina.kelas kl ON k.kelas_id = kl.kelas_id
      WHERE kl.guru_nip = ? AND d.tanggal_pengumpulan IS NULL
    `, [guruNip]);

    // Tugas terlambat
    const [[tugasTerlambat]] = await db.query(`
      SELECT COUNT(*) AS total 
      FROM db_cina.krs_detail_materi d
      JOIN db_cina.materi m ON d.materi_id = m.materi_id
      JOIN db_cina.krs k ON d.krs_id = k.krs_id
      JOIN db_cina.kelas kl ON k.kelas_id = kl.kelas_id
      WHERE kl.guru_nip = ? AND d.tanggal_pengumpulan IS NULL AND m.tanggal < CURDATE()
    `, [guruNip]);

    // Materi hari ini oleh guru
    const [[materiHariIni]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM db_cina.materi m
      JOIN db_cina.kelas k ON m.kelas_id = k.kelas_id
      WHERE k.guru_nip = ? AND DATE(m.tanggal) = CURDATE()
    `, [guruNip]);

    // Absensi siswa tidak hadir
    const [[absensiTidakHadir]] = await db.query(`
      SELECT COUNT(*) AS total
      FROM db_cina.absensi a
      WHERE a.guru_nip = ?
        AND DATE(a.tanggal) = CURDATE()
        AND a.keterangan IN ('i', 's', 'a')
    `, [guruNip]);

    // Inisialisasi data wali kelas
    let waliData = {
      kelas: wali ? wali.nama_kelas : null,
      tugas_belum_dikerjakan: 0,
      absensi_tidak_hadir: 0,
      tugas_terlambat: 0,
      materi_hari_ini: 0
    };

    if (wali) {
      const kelasId = wali.kelas_id;

      // Tugas belum dikerjakan di kelas wali
      const [[waliTugasBelum]] = await db.query(`
        SELECT COUNT(*) AS total 
        FROM db_cina.krs_detail_materi d
        JOIN db_cina.krs k ON d.krs_id = k.krs_id
        WHERE k.kelas_id = ? AND d.tanggal_pengumpulan IS NULL
      `, [kelasId]);

      // Tugas terlambat
      const [[waliTugasTerlambat]] = await db.query(`
        SELECT COUNT(*) AS total 
        FROM db_cina.krs_detail_materi d
        JOIN db_cina.krs k ON d.krs_id = k.krs_id
        JOIN db_cina.materi m ON d.materi_id = m.materi_id
        WHERE k.kelas_id = ? AND d.tanggal_pengumpulan IS NULL AND m.tanggal < CURDATE()
      `, [kelasId]);

      // Absensi tidak hadir
      const [[waliAbsensi]] = await db.query(`
        SELECT COUNT(*) AS total
        FROM db_cina.absensi a
        JOIN db_cina.krs k ON a.krs_id = k.krs_id
        WHERE k.kelas_id = ? AND DATE(a.tanggal) = CURDATE()
        AND a.keterangan IN ('i', 's', 'a')
      `, [kelasId]);

      // Materi untuk kelas wali hari ini
      const [[waliMateriHariIni]] = await db.query(`
        SELECT COUNT(*) AS total
        FROM db_cina.materi
        WHERE kelas_id = ? AND DATE(tanggal) = CURDATE()
      `, [kelasId]);

      waliData = {
        kelas: wali.nama_kelas,
        tugas_belum_dikerjakan: waliTugasBelum.total,
        tugas_terlambat: waliTugasTerlambat.total,
        absensi_tidak_hadir: waliAbsensi.total,
        materi_hari_ini: waliMateriHariIni.total
      };
    }

    res.status(200).json({
      success: true,
      mengajar: {
        mapel: mengajar.length ? mengajar[0].nama_mapel : null,
        kelas: mengajar.length ? mengajar[0].nama_kelas : null,
        tugas_belum_dikerjakan: tugasBelum.total,
        absensi_tidak_hadir: absensiTidakHadir.total,
        tugas_terlambat: tugasTerlambat.total,
        materi_hari_ini: materiHariIni.total
      },
      wali_kelas: waliData
    });

  } catch (err) {
    console.error('Error getRingkasanDashboardGuru:', err);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan', error: err.message });
  }
};




const getBerita = async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        b.berita_id, 
        b.judul, 
        b.foto, 
        b.isi, 
        b.tipe,
        b.created_at,
        g.nama_guru,
        u.username AS nama_admin
      FROM berita b
      LEFT JOIN guru g ON b.guru_nip = g.nip
      LEFT JOIN admin a ON b.admin_id = a.admin_id
      LEFT JOIN user u ON a.user_id = u.user_id
      ORDER BY b.created_at DESC;

    `);

    res.status(200).json({
      message: "Data berita berhasil diambil",
      status: 200,
      data: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Gagal mengambil data berita",
      error: err.message
    });
  }
};

const getBeritaById = async (req, res) => {
  const { id } = req.params; // ambil ID dari URL parameter

  try {
    const [results] = await db.query(`
      SELECT 
        b.berita_id, 
        b.judul, 
        b.foto, 
        b.isi, 
        b.tipe,
        b.created_at,
        g.nama_guru,
        u.username AS nama_admin
      FROM berita b
      LEFT JOIN guru g ON b.guru_nip = g.nip
      LEFT JOIN admin a ON b.admin_id = a.admin_id
      LEFT JOIN user u ON a.user_id = u.user_id
      WHERE b.berita_id = ?
      LIMIT 1;
    `, [id]);

    if (results.length === 0) {
      return res.status(404).json({
        message: "Berita tidak ditemukan",
        status: 404
      });
    }

    res.status(200).json({
      message: "Data berita berhasil diambil",
      status: 200,
      data: results[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Gagal mengambil data berita",
      error: err.message
    });
  }
};

const createBeritaGuru = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { judul, isi, tipe } = req.body;
    const foto = req.file ? req.file.filename : null;

    // Validasi input
    if (!judul || !isi || !tipe) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Judul, isi, dan tipe wajib diisi'
      });
    }

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip, nama_guru FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        message: 'Data guru tidak ditemukan' 
      });
    }

    const guru_nip = teacher[0].nip;
    const nama_guru = teacher[0].nama_guru;

    // Generate berita_id
    const berita_id = uuidv4();

    // Insert ke tabel berita
    await db.query(`
      INSERT INTO berita (
        berita_id,
        guru_nip,
        judul,
        isi,
        foto,
        tipe,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [berita_id, guru_nip, judul, isi, foto, tipe]);

    res.status(201).json({
      success: true,
      message: 'Berita berhasil dibuat',
      data: {
        berita_id,
        nama_guru,
        judul,
        foto
      }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal membuat berita',
      error: error.message
    });
  }
};

const updateBeritaGuru = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { berita_id } = req.params;
    const { judul, isi, tipe } = req.body;
    const foto = req.file ? req.file.filename : null;

    // Validasi minimal satu field diupdate
    if (!judul && !isi && !tipe && !foto) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Minimal satu field harus diupdate (judul/isi/tipe/foto)'
      });
    }

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ 
        success: false, 
        message: 'Data guru tidak ditemukan' 
      });
    }

    const guru_nip = teacher[0].nip;

    // Cek kepemilikan berita
    const [beritaCheck] = await db.query(
      `SELECT foto FROM berita WHERE berita_id = ? AND guru_nip = ?`,
      [berita_id, guru_nip]
    );

    if (!beritaCheck.length) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Berita tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    // Hapus foto lama jika ada foto baru
    const oldFoto = beritaCheck[0].foto;
    if (foto && oldFoto) {
      const fotoPath = path.join(__dirname, '../../express-admin/Upload/profile_image', oldFoto);
      if (fs.existsSync(fotoPath)) {
        fs.unlinkSync(fotoPath);
      }
    }

    // Bangun query update dinamis
    const updateFields = [];
    const updateValues = [];

    if (judul) {
      updateFields.push('judul = ?');
      updateValues.push(judul);
    }
    if (isi) {
      updateFields.push('isi = ?');
      updateValues.push(isi);
    }
    if (tipe) {
      updateFields.push('tipe = ?');
      updateValues.push(tipe);
    }
    if (foto) {
      updateFields.push('foto = ?');
      updateValues.push(foto);
    }

    updateValues.push(berita_id, guru_nip);

    const query = `
      UPDATE berita 
      SET ${updateFields.join(', ')} 
      WHERE berita_id = ? AND guru_nip = ?
    `;

    await db.query(query, updateValues);

    res.status(200).json({
      success: true,
      message: 'Berita berhasil diperbarui',
      data: {
        berita_id,
        updated_fields: updateFields
      }
    });

  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui berita',
      error: error.message
    });
  }
};

const deleteBeritaGuru = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { berita_id } = req.params;

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Data guru tidak ditemukan' 
      });
    }

    const guru_nip = teacher[0].nip;

    // Cek kepemilikan berita dan ambil info foto
    const [beritaCheck] = await db.query(
      `SELECT foto FROM berita WHERE berita_id = ? AND guru_nip = ?`,
      [berita_id, guru_nip]
    );

    if (!beritaCheck.length) {
      return res.status(404).json({
        success: false,
        message: 'Berita tidak ditemukan atau Anda tidak memiliki akses'
      });
    }

    // Hapus file foto jika ada
    const foto = beritaCheck[0].foto;
    if (foto) {
      const fotoPath = path.join(__dirname, '../../express-admin/Upload/profile_image', foto);
      if (fs.existsSync(fotoPath)) {
        fs.unlinkSync(fotoPath);
      }
    }

    // Hapus berita dari database
    await db.query(
      `DELETE FROM berita WHERE berita_id = ? AND guru_nip = ?`,
      [berita_id, guru_nip]
    );

    res.status(200).json({
      success: true,
      message: 'Berita berhasil dihapus',
      data: {
        berita_id,
        deleted_foto: foto ? true : false
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus berita',
      error: error.message
    });
  }
};

const getSiswaPengumpulanTugas = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id, tugas_id } = req.params;

    // Validasi parameter
    if (!mapel_id || !tugas_id) {
      return res.status(400).json({
        success: false,
        message: 'mapel_id dan tugas_id diperlukan sebagai parameter'
      });
    }

    // Ambil NIP guru berdasarkan userId
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan'
      });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi bahwa guru mengajar mapel ini dan tugas ini terkait dengan mapel
    const [verifikasi] = await db.query(`
      SELECT 1 
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kdm.tugas_id = ?
      AND kd.mapel_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [tugas_id, mapel_id, guru_nip]);

    if (!verifikasi.length) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke tugas ini atau data tidak ditemukan'
      });
    }

    // Query untuk mendapatkan siswa yang sudah mengumpulkan tugas
    const [siswaPengumpulan] = await db.query(`
      SELECT 
        s.nis,
        s.nama_siswa,
        kdm.tanggal_pengumpulan,
        kdm.uraian,
        kdm.file_jawaban,
        kdm.nilai,
        CASE 
          WHEN kdm.tanggal_pengumpulan > t.tenggat_kumpul THEN 'Terlambat'
          ELSE 'Tepat Waktu'
        END as status_pengumpulan,
        t.tenggat_kumpul,
        t.judul as judul_tugas
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis  /* Diubah dari k.nis ke k.siswa_nis */
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      WHERE kdm.tugas_id = ?
      AND kd.mapel_id = ?
      AND kd.guru_nip = ?
      AND kdm.tanggal_pengumpulan IS NOT NULL
      ORDER BY kdm.tanggal_pengumpulan DESC
    `, [tugas_id, mapel_id, guru_nip]);

    // Query untuk mendapatkan siswa yang belum mengumpulkan
    const [siswaBelumMengumpulkan] = await db.query(`
      SELECT 
        s.nis,
        s.nama_siswa
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis  /* Diubah dari k.nis ke k.siswa_nis */
      LEFT JOIN krs_detail_materi kdm ON kd.krs_id = kdm.krs_id AND kdm.tugas_id = ?
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
      AND (kdm.tanggal_pengumpulan IS NULL OR kdm.kdm_id IS NULL)
      ORDER BY s.nama_siswa
    `, [tugas_id, mapel_id, guru_nip]);

    res.status(200).json({
      success: true,
      data: {
        sudah_mengumpulkan: siswaPengumpulan,
        belum_mengumpulkan: siswaBelumMengumpulkan,
        total_sudah_mengumpulkan: siswaPengumpulan.length,
        total_belum_mengumpulkan: siswaBelumMengumpulkan.length
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
      error: error.message
    });
  }
};

const beriNilaiTugasSiswa = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id, tugas_id, krs_id } = req.params;
    const { nilai } = req.body;

    // Validasi input
    if (!mapel_id || !tugas_id || !krs_id || nilai === undefined || nilai === null) {
      return res.status(400).json({
        success: false,
        message: 'mapel_id, tugas_id, krs_id, dan nilai wajib diisi'
      });
    }

    // Validasi nilai harus angka antara 0-100
    if (isNaN(nilai) || nilai < 0 || nilai > 100) {
      return res.status(400).json({
        success: false,
        message: 'Nilai harus berupa angka antara 0-100'
      });
    }

    // Ambil NIP guru
    const [teacher] = await db.query(
      `SELECT nip FROM guru WHERE user_id = ?`,
      [userId]
    );

    if (!teacher.length) {
      return res.status(404).json({
        success: false,
        message: 'Data guru tidak ditemukan'
      });
    }

    const guru_nip = teacher[0].nip;

    // Verifikasi bahwa:
    // 1. Guru mengajar mapel ini
    // 2. Tugas ini terkait dengan mapel
    // 3. Siswa (krs_id) termasuk dalam mapel ini
    const [verifikasi] = await db.query(`
      SELECT 1 
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      WHERE kdm.tugas_id = ?
      AND kd.mapel_id = ?
      AND kd.guru_nip = ?
      AND kdm.krs_id = ?
      LIMIT 1
    `, [tugas_id, mapel_id, guru_nip, krs_id]);

    if (!verifikasi.length) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk memberi nilai pada tugas ini atau data tidak valid'
      });
    }

    // Update nilai di krs_detail_materi
    const [result] = await db.query(`
      UPDATE krs_detail_materi
      SET nilai = ?
      WHERE tugas_id = ?
      AND krs_id = ?
    `, [nilai, tugas_id, krs_id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Data pengumpulan tugas tidak ditemukan'
      });
    }

    // Ambil data terbaru untuk response
    const [updatedData] = await db.query(`
      SELECT 
        s.nis,
        s.nama_siswa,
        kdm.tanggal_pengumpulan,
        kdm.nilai,
        t.judul as judul_tugas,
        m.nama_mapel
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      WHERE kdm.tugas_id = ?
      AND kdm.krs_id = ?
      LIMIT 1
    `, [tugas_id, krs_id]);

    res.status(200).json({
      success: true,
      message: 'Nilai berhasil diperbarui',
      data: updatedData[0]
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui nilai',
      error: error.message
    });
  }
};

const getDetailRaporSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { tahun_akademik_id } = req.params;

  try {
    // 1. Ambil biodata siswa
    const [siswaResults] = await db.query(`
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        s.tempat_lahir,
        s.tanggal_lahir,
        s.alamat,
        s.jenis_kelamin,
        s.agama,
        s.no_telepon,
        s.foto_profil,
        u.username,
        u.email
      FROM siswa s
      JOIN user u ON s.user_id = u.user_id
      WHERE u.user_id = ?
    `, [userId]);
    
    const siswa = siswaResults[0];
    
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil detail kelas
    const [[kelas]] = await db.query(`
      SELECT 
        kl.kelas_id,
        kl.nama_kelas,
        kl.tingkat,
        kl.jenjang,
        ta.tahun_akademik_id,
        ta.tahun_mulai,
        ta.tahun_berakhir,
        kr.nama_kurikulum,
        g.nip AS wali_kelas_nip,
        g.nama_guru AS wali_kelas,
        g.foto_profil AS foto_wali_kelas
      FROM krs k
      JOIN kelas kl ON k.kelas_id = kl.kelas_id
      JOIN tahun_akademik ta ON (kl.kurikulum_id = ta.kurikulum_id AND kl.tahun_akademik_id = ta.tahun_akademik_id)
      JOIN kurikulum kr ON kl.kurikulum_id = kr.kurikulum_id
      LEFT JOIN guru g ON kl.guru_nip = g.nip
      WHERE k.siswa_nis = ?
        AND ta.tahun_akademik_id = ?
      LIMIT 1
    `, [siswa.nis, tahun_akademik_id]);

    if (!kelas) {
      return res.status(404).json({ 
        message: 'Data kelas tidak ditemukan untuk tahun akademik ini' 
      });
    }

    // 3. Ambil semua nilai dari krs_detail - PERBAIKAN DI SINI
    const [nilaiList] = await db.query(`
      SELECT 
        kd.mapel_id,
        m.nama_mapel,
        kd.nilai AS nilai_pengetahuan,
        kd.keterampilan AS nilai_keterampilan,
        kd.kkm,
        CASE
          WHEN kd.nilai IS NOT NULL AND kd.keterampilan IS NOT NULL 
          THEN ROUND((kd.nilai + kd.keterampilan) / 2, 2)
          ELSE NULL
        END AS nilai_akhir,
        CASE 
          WHEN kd.nilai IS NOT NULL AND kd.keterampilan IS NOT NULL AND
               (kd.nilai + kd.keterampilan) / 2 >= kd.kkm 
          THEN 'Tuntas'
          WHEN kd.nilai IS NULL OR kd.keterampilan IS NULL
          THEN 'Belum Lengkap'
          ELSE 'Belum Tuntas'
        END AS status,
        g.nama_guru AS guru_pengampu
      FROM krs_detail kd
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      LEFT JOIN guru g ON kd.guru_nip = g.nip
      WHERE kd.krs_id IN (
        SELECT krs_id FROM krs 
        WHERE siswa_nis = ? 
        AND kelas_id = ?
      )
      ORDER BY m.nama_mapel ASC
    `, [siswa.nis, kelas.kelas_id]);

    // 4. Hitung statistik nilai
    const nilaiTerisi = nilaiList.filter(n => n.nilai_pengetahuan !== null && n.nilai_keterampilan !== null);
    const totalMapel = nilaiTerisi.length;
    const totalTuntas = nilaiTerisi.filter(n => n.status === 'Tuntas').length;
    const totalBelumTuntas = totalMapel - totalTuntas;
    
    const rataRataPengetahuan = totalMapel > 0 
      ? parseFloat((nilaiTerisi.reduce((sum, n) => sum + n.nilai_pengetahuan, 0) / totalMapel).toFixed(2))
      : 0;

    const rataRataKeterampilan = totalMapel > 0 
      ? parseFloat((nilaiTerisi.reduce((sum, n) => sum + n.nilai_keterampilan, 0) / totalMapel).toFixed(2))
      : 0;

    const rataRataAkhir = totalMapel > 0 
      ? parseFloat((nilaiTerisi.reduce((sum, n) => sum + n.nilai_akhir, 0) / totalMapel).toFixed(2))
      : 0;
      
    // 5. Siapkan data untuk PDF
    const pdfData = {
      siswa: {
        nis: siswa.nis,
        nisn: siswa.nisn,
        nama_siswa: siswa.nama_siswa,
        tempat_lahir: siswa.tempat_lahir,
        tanggal_lahir: siswa.tanggal_lahir,
        alamat: siswa.alamat,
        jenis_kelamin: siswa.jenis_kelamin,
        agama: siswa.agama,
        no_telepon: siswa.no_telepon,
        foto_profil: siswa.foto_profil
      },
      kelas: {
        kelas_id: kelas.kelas_id,
        nama_kelas: kelas.nama_kelas,
        tingkat: kelas.tingkat,
        jenjang: kelas.jenjang,
        tahun_akademik_id: kelas.tahun_akademik_id,
        tahun_mulai: kelas.tahun_mulai,
        tahun_berakhir: kelas.tahun_berakhir,
        nama_kurikulum: kelas.nama_kurikulum,
        wali_kelas: kelas.wali_kelas,
        foto_wali_kelas: kelas.foto_wali_kelas
      },
      nilai: nilaiList,
      statistik: {
        total_mapel: totalMapel,
        total_tuntas: totalTuntas,
        total_belum_tuntas: totalBelumTuntas,
        total_belum_lengkap: nilaiList.length - totalMapel,
        rata_rata_pengetahuan: rataRataPengetahuan,
        rata_rata_keterampilan: rataRataKeterampilan,
        rata_rata_nilai_akhir: rataRataAkhir
      },
      catatan: {
        tanggal_cetak: new Date().toISOString(),
        keterangan: 'Rapor ini dicetak secara elektronik dan sah tanpa tanda tangan basah'
      }
    };

    // 6. Generate PDF
    const pdfResult = await generateRaporPdf(pdfData);

    // 7. Response
    res.status(200).json({
      message: 'Detail rapor siswa berhasil diambil',
      status: 200,
      data: {
        ...pdfData,
        pdf_url: pdfResult.filePath,
        download_url: `/api/dashboard/rapor/download/${path.basename(pdfResult.filename)}`
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil detail rapor siswa',
      error: err.message
    });
  }
};

// Tambahkan fungsi untuk download PDF
const downloadRaporPdf = async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '../public/reports', filename);

  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).json({ message: 'File rapor tidak ditemukan' });
  }
};

const getSuratIzinSakit = async (req, res) => {
  try {
    const [[guru]] = await db.query('SELECT nip FROM guru WHERE user_id = ?', [req.user.userId]);
    if (!guru) return res.status(404).json({ success: false, message: 'Guru tidak ditemukan' });

    const [rows] = await db.query(`
      SELECT 
        a.absensi_id,
        s.nama_siswa,
        s.nis,
        DATE(a.tanggal) AS tanggal_izin,
        a.keterangan,
        a.surat,
        a.status_surat
      FROM absensi a
      JOIN krs k ON a.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE a.keterangan IN ('i', 's') AND a.status_surat = 'menunggu'
      ORDER BY a.tanggal DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getSuratIzinSakit Error:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data surat izin/sakit' });
  }
};



const setujuiSuratIzin = async (req, res) => {
  try {
    const { absensi_id } = req.params;

    const [result] = await db.query(
      `UPDATE absensi SET status_surat = 'terima' WHERE absensi_id = ?`,
      [absensi_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });
    }

    res.json({ success: true, message: 'Surat izin berhasil disetujui' });
  } catch (err) {
    console.error('setujuiSuratIzin Error:', err);
    res.status(500).json({ success: false, message: 'Gagal menyetujui surat izin' });
  }
};



const tolakSuratIzin = async (req, res) => {
  const { absensi_id } = req.params;

  try {
    const [cek] = await db.query(`SELECT * FROM absensi WHERE absensi_id = ?`, [absensi_id]);
    if (!cek.length) {
      return res.status(404).json({ success: false, message: 'Surat tidak ditemukan' });
    }

    await db.query(`UPDATE absensi SET status_surat = 'tolak' WHERE absensi_id = ?`, [absensi_id]);

    res.json({ success: true, message: 'Surat izin ditolak' });
  } catch (err) {
    console.error('tolakSuratIzin Error:', err);
    res.status(500).json({ success: false, message: 'Gagal memproses surat', error: err.message });
  }
};




// Add these to your exports
module.exports = {
  getdashboard,
  getJadwalGuru,
  getSiswaByKelasGuru,
  getMapelGuru,
  createTugasForSiswa,
    updateTugasById,
    deleteTugasById,
  createMateriForSiswa,
    updateMateriById,
    deleteMateriById,
  getTugasGuruByMapel,
  getMateriGuruByMapel,
  getTugasDetailById,
  getMateriDetailById,
  createAbsensiSiswa,
  getAbsensiByJadwal,
  getRingkasanDashboardGuru,
  getBerita,
  getBeritaById,
createBeritaGuru,
  updateBeritaGuru,
  deleteBeritaGuru,
getSiswaPengumpulanTugas,
beriNilaiTugasSiswa,
downloadRaporPdf,
getSuratIzinSakit,
setujuiSuratIzin,
tolakSuratIzin
};