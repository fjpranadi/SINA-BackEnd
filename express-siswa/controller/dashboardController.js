const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project
const fs = require('fs');
const path = require('path');


const getBiodataSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];

    if (!siswa) {
      return res.status(403).json({ message: 'Data biodata siswa tidak ditemukan' });
    }

    res.status(200).json({
      message: `Biodata siswa dengan ID ${userId} berhasil diambil`,
      status: 200,
      biodata: {
        nis: siswa.nis,
        nama: siswa.nama_siswa,
        tempat_lahir: siswa.tempat_lahir,
        tanggal_lahir: siswa.tanggal_lahir,
        foto_profil: siswa.foto_profil,
        alamat: siswa.alamat,
        kelas: siswa.nama_kelas,
        tahun_akademik: siswa.tahun_akademik_id,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil biodata siswa.' });
  }
};

const getJadwalSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    // Ambil NIS siswa dari prosedur
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];

    if (!siswa) {
      return res.status(403).json({ message: 'Data siswa tidak ditemukan' });
    }

const [jadwalResult] = await db.query(`
  SELECT 
    j.hari, 
    mj.start, 
    mj.finish, 
    m.nama_mapel, 
    g.nama_guru
  FROM jadwal j
  LEFT JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
  LEFT JOIN mapel m ON j.mapel_id = m.mapel_id
  LEFT JOIN krs_detail kd ON (
    j.mapel_id = kd.mapel_id 
    AND j.kelas_id = (
      SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1
    )
  )
  LEFT JOIN guru g ON kd.guru_nip = g.nip
  WHERE j.kelas_id = (
    SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1
  )
`, [siswa.nis, siswa.nis]);

    res.status(200).json({
      message: `Jadwal siswa dengan ID ${userId} berhasil diambil`,
      status: 200,
      jadwal_pelajaran: jadwalResult
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil jadwal siswa.' });
  }
};

const getJadwalSiswabyhari = async (req, res) => {
  const userId = req.user.userId;
  const hari = req.params.hari; // Ambil parameter hari dari URL

  try {
    // Ambil NIS siswa dari prosedur
    const [results] = await db.query('CALL sp_get_dashboard_siswa(?)', [userId]);
    const siswa = results[0][0];

    if (!siswa) {
      return res.status(403).json({ message: 'Data siswa tidak ditemukan' });
    }

    const [jadwalResult] = await db.query(`
      SELECT 
        j.hari, 
        mj.start, 
        mj.finish, 
        m.nama_mapel, 
        g.nama_guru,
        j.ruangan
      FROM jadwal j
      LEFT JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      LEFT JOIN mapel m ON j.mapel_id = m.mapel_id
      LEFT JOIN krs_detail kd ON (
        j.mapel_id = kd.mapel_id 
        AND j.kelas_id = (
          SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1
        )
      )
      LEFT JOIN guru g ON kd.guru_nip = g.nip
      WHERE j.kelas_id = (
        SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1
      )
      AND j.hari = ?  -- Filter berdasarkan hari
      ORDER BY mj.start ASC  -- Urutkan berdasarkan jam mulai
    `, [siswa.nis, siswa.nis, hari]);

    res.status(200).json({
      message: `Jadwal siswa dengan ID ${userId} pada hari ${hari} berhasil diambil`,
      status: 200,
      jadwal_pelajaran: jadwalResult
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil jadwal siswa.' });
  }
};


const editDataDiriSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { nama, tempat_lahir, tanggal_lahir, alamat } = req.body;
  const fotoBaru = req.file ? req.file.filename : null;

  try {
    // 1. Ambil data siswa saat ini
    const [[siswa]] = await db.query('SELECT * FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    // 2. Tentukan nilai yang akan diupdate (gunakan nilai baru jika ada, jika tidak gunakan nilai lama)
    const updateData = {
      nama_siswa: nama || siswa.nama_siswa,
      tempat_lahir: tempat_lahir || siswa.tempat_lahir,
      tanggal_lahir: tanggal_lahir || siswa.tanggal_lahir,
      alamat: alamat || siswa.alamat,
      foto_profil: fotoBaru || siswa.foto_profil
    };

    // 3. Hapus foto lama jika ada foto baru yang diupload
    if (fotoBaru && siswa.foto_profil && siswa.foto_profil !== fotoBaru) {
      const pathLama = path.join(__dirname, '../Upload/profile_image', siswa.foto_profil);
      if (fs.existsSync(pathLama)) {
        fs.unlinkSync(pathLama);
      }
    }

    // 4. Lakukan update hanya jika ada perubahan
    const isChanged = (
      updateData.nama_siswa !== siswa.nama_siswa ||
      updateData.tempat_lahir !== siswa.tempat_lahir ||
      updateData.tanggal_lahir !== siswa.tanggal_lahir ||
      updateData.alamat !== siswa.alamat ||
      updateData.foto_profil !== siswa.foto_profil
    );

    if (!isChanged) {
      return res.status(200).json({
        message: 'Tidak ada perubahan data',
        status: 200,
        data: siswa
      });
    }

    // 5. Eksekusi update ke database
    await db.query(
      `UPDATE siswa 
       SET nama_siswa = ?, tempat_lahir = ?, tanggal_lahir = ?, alamat = ?, foto_profil = ?
       WHERE user_id = ?`,
      [
        updateData.nama_siswa,
        updateData.tempat_lahir,
        updateData.tanggal_lahir,
        updateData.alamat,
        updateData.foto_profil,
        userId
      ]
    );

    // 6. Ambil data terbaru setelah update
    const [[updatedSiswa]] = await db.query('SELECT * FROM siswa WHERE user_id = ?', [userId]);

    res.status(200).json({
      message: 'Biodata berhasil diperbarui',
      status: 200,
      data: updatedSiswa
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Terjadi kesalahan saat memperbarui biodata',
      error: err.message
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

const getMateriSiswa = async (req, res) => {
  const userId = req.user.userId; // Dari token
  const { jadwal_id } = req.params;

  try {
    // 1. Ambil data siswa berdasarkan user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil kelas siswa dari tabel KRS
    const [[krs]] = await db.query('SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });
    }

    // 3. Verifikasi jadwal sesuai dengan kelas siswa
    const [[jadwal]] = await db.query(
      `SELECT * FROM jadwal WHERE jadwal_id = ? AND kelas_id = ?`,
      [jadwal_id, krs.kelas_id]
    );

    if (!jadwal) {
      return res.status(403).json({ message: 'Jadwal tidak valid untuk kelas siswa' });
    }

    // 4. Ambil materi dari mapel di jadwal tersebut
    const [materiList] = await db.query(
      `SELECT m.materi_id, m.nama_materi, m.uraian, m.lampiran, m.created_at
       FROM materi m
       WHERE m.krs_id IN (
         SELECT krs_id FROM krs WHERE siswa_nis = ?
       )
       AND m.mapel_id = ?`,
      [siswa.nis, jadwal.mapel_id]
    );

    res.status(200).json({
      message: 'Data materi berhasil diambil',
      status: 200,
      data: materiList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil data materi',
      error: err.message
    });
  }
};

const getTugasSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { jadwal_id } = req.params;

  try {
    // 1. Ambil NIS siswa dari user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil kelas siswa dari KRS
    const [[krs]] = await db.query('SELECT kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'Kelas siswa tidak ditemukan' });
    }

    // 3. Verifikasi jadwal milik kelas siswa
    const [[jadwal]] = await db.query(
      `SELECT * FROM jadwal WHERE jadwal_id = ? AND kelas_id = ?`,
      [jadwal_id, krs.kelas_id]
    );
    if (!jadwal) {
      return res.status(403).json({ message: 'Jadwal tidak valid untuk kelas siswa' });
    }

    // 4. Ambil tugas dari mapel tersebut
    const [tugasList] = await db.query(
      `SELECT 
         t.tugas_id,
         t.judul,
         t.deskripsi,
         t.lampiran,
         t.uraian,
         t.tenggat_kumpul,
         t.tanggal_pengumpulan,
         t.file_jawaban,
         t.nilai
       FROM tugas t
       WHERE t.krs_id IN (
         SELECT krs_id FROM krs WHERE siswa_nis = ?
       )
       AND t.mapel_id = ?`,
      [siswa.nis, jadwal.mapel_id]
    );

    res.status(200).json({
      message: 'Data tugas berhasil diambil',
      status: 200,
      data: tugasList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil data tugas',
      error: err.message
    });
  }
};

const editTugasSiswa = async (req, res) => {
  const { tugas_id } = req.params;
  const { uraian } = req.body;
  const userId = req.user.userId; // Ambil userId dari token
  const tanggal_pengumpulan = new Date(); // gunakan waktu sekarang

  try {
    // 1. Ambil NIS siswa dari userId
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    // 2. Cek apakah tugas tersebut terkait dengan siswa ini melalui KRS
    const [[krsDetailMateri]] = await db.query(`
      SELECT kdm.* 
      FROM krs_detail_materi kdm
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id AND kdm.mapel_id = kd.mapel_id
      JOIN krs k ON kd.krs_id = k.krs_id
      WHERE kdm.tugas_id = ? AND k.siswa_nis = ?
    `, [tugas_id, siswa.nis]);

    if (!krsDetailMateri) {
      return res.status(404).json({ 
        message: 'Tugas tidak ditemukan atau tidak terkait dengan siswa ini' 
      });
    }

    let file_jawaban = krsDetailMateri.file_jawaban;

    // 3. Jika ada file baru diupload
    if (req.file) {
      // Hapus file lama jika ada
      if (file_jawaban && fs.existsSync(path.join('upload/tugas', file_jawaban))) {
        fs.unlinkSync(path.join('upload/tugas', file_jawaban));
      }

      file_jawaban = req.file.filename;
    }

    // 4. Update data di krs_detail_materi
    await db.query(`
      UPDATE krs_detail_materi 
      SET 
        uraian = ?, 
        file_jawaban = ?, 
        tanggal_pengumpulan = ?
      WHERE kdm_id = ?
    `, [uraian, file_jawaban, tanggal_pengumpulan, krsDetailMateri.kdm_id]);

    res.status(200).json({
      message: 'Tugas berhasil dikumpulkan',
      status: 200,
      data: {
        tugas_id,
        file_jawaban,
        tanggal_pengumpulan,
        uraian
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengumpulkan tugas',
      error: err.message
    });
  }
};

const getDashboardRingkasanSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil NIS siswa
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil krs_id dan kelas_id
    const [[krs]] = await db.query('SELECT krs_id, kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'KRS tidak ditemukan' });
    }

    // 3. Tugas belum dikerjakan (tanggal_pengumpulan IS NULL)
   const [[belumDikerjakan]] = await db.query(`
  SELECT COUNT(DISTINCT materi_id) AS total
  FROM krs_detail_materi
  WHERE krs_id = ?
    AND tanggal_pengumpulan IS NULL
`, [krs.krs_id]);

    // 4. Tugas terlambat (tanggal_pengumpulan > tenggat_kumpul)
    const [[terlambat]] = await db.query(`
      SELECT COUNT(*) AS total
FROM krs_detail_materi kdm
JOIN tugas t ON kdm.tugas_id = t.tugas_id
WHERE kdm.krs_id = ?
  AND kdm.tanggal_pengumpulan IS NOT NULL
  AND kdm.tanggal_pengumpulan > t.tenggat_kumpul
    `, [krs.krs_id]);

    // 5. Absensi tidak hadir (izin, sakit, alpha)
    const [[absensi]] = await db.query(`
      SELECT 
        SUM(keterangan = 'i' OR keterangan = 's' OR keterangan = 'a') AS tidak_hadir
      FROM absensi
      WHERE krs_id = ?
    `, [krs.krs_id]);


    // Kirim response
    res.status(200).json({
      status: 200,
      data: {
        tugas_belum_dikerjakan: belumDikerjakan.total || 0,
        tugas_terlambat: terlambat.total || 0,
        absensi_tidak_hadir: absensi.tidak_hadir || 0,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      status: 500,
      message: 'Gagal mengambil ringkasan dashboard',
      error: err.message
    });
  }
};

const getMateriHariIni = async (req, res) => {
  const userId = req.user.userId;
  const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

  try {
    // 1. Ambil NIS siswa dari user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil krs_id siswa
    const [[krs]] = await db.query('SELECT krs_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) {
      return res.status(404).json({ message: 'KRS siswa tidak ditemukan' });
    }

    // 3. Ambil materi hari ini melalui krs_detail_materi
    const [materiList] = await db.query(`
      SELECT 
        m.materi_id,
        m.nama_materi,
        m.uraian,
        m.lampiran,
        m.created_at,
        kdm.mapel_id,
        mp.nama_mapel,
        j.hari,
        mj.start,
        mj.finish
      FROM krs_detail_materi kdm
      JOIN materi m ON kdm.materi_id = m.materi_id
      JOIN mapel mp ON kdm.mapel_id = mp.mapel_id
      LEFT JOIN jadwal j ON (
        kdm.mapel_id = j.mapel_id 
        AND j.kelas_id = (SELECT kelas_id FROM krs WHERE krs_id = ?)
      )
      LEFT JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      WHERE kdm.krs_id = ?
        AND DATE(m.created_at) = ?
      ORDER BY m.created_at DESC
    `, [krs.krs_id, krs.krs_id, today]);

    res.status(200).json({
      message: 'Materi hari ini berhasil diambil',
      status: 200,
      data: materiList
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil materi hari ini',
      error: err.message
    });
  }
};

const getSiswaCount = async (req, res) => {
  try {
    //Ambil userId dari JWT
    const userId = req.user?.userId;

    //Pastikan userId terbaca
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID tidak ditemukan di JWT'
      });
    }

    //Ambil NIS siswa dari user_id
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

    //Hitung tugas belum dikerjakan
    const [tugasBelumQuery] = await db.query(`
      SELECT COUNT(*) AS total
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      JOIN krs k ON kdm.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE s.user_id = ?
        AND (kdm.tanggal_pengumpulan IS NULL OR kdm.tanggal_pengumpulan = '')
    `, [userId]);
    const tugasBelum = tugasBelumQuery[0].total;

    //Hitung absensi tidak hadir
    const [absenQuery] = await db.query(`
      SELECT COUNT(*) AS total
      FROM absensi a
      JOIN krs k ON a.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE s.user_id = ?
        AND a.keterangan IN ('a', 'i', 's')
    `, [userId]);
    const absensiTidakHadir = absenQuery[0].total;

    //Hitung tugas terlambat
    const [tugasTerlambatQuery] = await db.query(`
      SELECT COUNT(*) AS total
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      JOIN krs k ON kdm.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE s.user_id = ?
        AND kdm.tanggal_pengumpulan > t.tenggat_kumpul
    `, [userId]);
    const tugasTerlambat = tugasTerlambatQuery[0].total;

    //Hitung materi hari ini
    const [materiHariIniQuery] = await db.query(`
      SELECT COUNT(*) AS total
      FROM krs_detail_materi kdm
      JOIN materi m ON kdm.materi_id = m.materi_id
      JOIN krs k ON kdm.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      WHERE DATE(kdm.created_at) = CURDATE()
        AND s.user_id = ?
    `, [userId]);
    const materiHariIni = materiHariIniQuery[0].total;

    //Response
    res.status(200).json({
      success: true,
      data: {
        tugas_belum_dikerjakan: tugasBelum,
        absensi_tidak_hadir: absensiTidakHadir,
        tugas_terlambat: tugasTerlambat,
        materi_hari_ini: materiHariIni
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data siswa',
      error: error.message
    });
  }
};

module.exports = {getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa, editTugasSiswa, getBeritaById, getDashboardRingkasanSiswa, getJadwalSiswabyhari, getMateriHariIni, getSiswaCount  };