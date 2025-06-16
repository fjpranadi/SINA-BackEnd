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

const createAbsensiSiswa = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { mapel_id } = req.params;
    const { absensiData } = req.body; // Array of { krs_id, keterangan, uraian, surat }
    const tanggal = new Date(); // Current date and time

    // Get teacher NIP
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

    // Verify the teacher teaches this subject
    const [mapelCheck] = await db.query(
      `SELECT 1 FROM krs_detail WHERE guru_nip = ? AND mapel_id = ? LIMIT 1`,
      [guru_nip, mapel_id]
    );

    if (!mapelCheck.length) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak mengajar mata pelajaran ini'
      });
    }

    // Get all students in this subject
    const [siswaList] = await db.query(`
      SELECT 
        kd.krs_id,
        s.nis,
        s.nama_siswa as nama
      FROM krs_detail kd
      JOIN krs k ON kd.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE kd.mapel_id = ?
      AND kd.guru_nip = ?
    `, [mapel_id, guru_nip]);

    if (!siswaList.length) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada siswa yang mengambil mata pelajaran ini'
      });
    }

    // Prepare attendance data
    const absensiRecords = [];
    const insertedAbsensiIds = [];

    for (const siswa of siswaList) {
      const absensi_id = uuidv4();
      const jadwal_id = null; // Can be added if needed
      
      // Find if this student has specific attendance data
      const specificAbsensi = absensiData?.find(item => item.krs_id === siswa.krs_id);
      
      const keterangan = specificAbsensi?.keterangan || 'h'; // Default to 'hadir'
      const uraian = specificAbsensi?.uraian || (keterangan === 'h' ? 'Hadir' : '');
      const surat = specificAbsensi?.surat || null;

      absensiRecords.push([
        absensi_id,
        jadwal_id,
        siswa.krs_id,
        guru_nip,
        keterangan,
        tanggal,
        uraian,
        surat,
        new Date()
      ]);

      insertedAbsensiIds.push(absensi_id);
    }

    // Insert all attendance records in a single transaction
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

    // Get the jadwal_id for this subject (if needed for future reference)
    const [jadwalInfo] = await db.query(`
      SELECT j.jadwal_id 
      FROM jadwal j
      JOIN krs_detail kd ON j.mapel_id = kd.mapel_id
      WHERE j.mapel_id = ?
      AND kd.guru_nip = ?
      LIMIT 1
    `, [mapel_id, guru_nip]);

    // Update jadwal_id in the attendance records if available
    if (jadwalInfo.length > 0) {
      await db.query(`
        UPDATE absensi 
        SET jadwal_id = ?
        WHERE absensi_id IN (?)
      `, [jadwalInfo[0].jadwal_id, insertedAbsensiIds]);
    }

    res.status(201).json({
      success: true,
      message: 'Absensi berhasil dicatat',
      data: {
        jumlah_siswa: siswaList.length,
        tanggal: tanggal,
        mapel_id: mapel_id
      }
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mencatat absensi',
      error: error.message
    });
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
// Add these to your exports
module.exports = {
  getdashboard,
  getJadwalGuru,
  getSiswaByKelasGuru,
  getMapelGuru,
  createTugasForSiswa,
  createMateriForSiswa,
  getTugasGuruByMapel,
  getMateriGuruByMapel,
  getTugasDetailById,
  getMateriDetailById,
  createAbsensiSiswa,
  getBerita,
  getBeritaById,
createBeritaGuru,
  updateBeritaGuru,
  deleteBeritaGuru,
getSiswaPengumpulanTugas,
beriNilaiTugasSiswa 
};