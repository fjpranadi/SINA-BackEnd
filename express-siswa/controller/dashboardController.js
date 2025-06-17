const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { generateRaporPdf } = require('../middleware/generatePdf');


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
  const today = new Date();
  const todayDateString = today.toISOString().split('T')[0];
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(today.getDate() - 3);
  const hariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][today.getDay()];

  try {
    // 1. Ambil data siswa dan krs_id
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

    const [[krs]] = await db.query('SELECT krs_id, kelas_id FROM krs WHERE siswa_nis = ? LIMIT 1', [siswa.nis]);
    if (!krs) return res.status(404).json({ message: 'KRS siswa tidak ditemukan' });

    // 2. Hitung statistik
    const [[tugasBelumDikerjakan]] = await db.query(`
      SELECT COUNT(*) as count 
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      WHERE kdm.krs_id = ? 
        AND kdm.tanggal_pengumpulan IS NULL
        AND t.tenggat_kumpul >= ?
    `, [krs.krs_id, today]);

    const [[tugasTerlambat]] = await db.query(`
      SELECT COUNT(*) as count 
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      WHERE kdm.krs_id = ? 
        AND kdm.tanggal_pengumpulan IS NOT NULL
        AND kdm.tanggal_pengumpulan > t.tenggat_kumpul
    `, [krs.krs_id]);

    const [[tugasMelewatiTenggat]] = await db.query(`
      SELECT COUNT(*) as count 
      FROM krs_detail_materi kdm
      JOIN tugas t ON kdm.tugas_id = t.tugas_id
      WHERE kdm.krs_id = ? 
        AND kdm.tanggal_pengumpulan IS NULL
        AND t.tenggat_kumpul < ?
    `, [krs.krs_id, today]);

    const [[absensiTidakHadir]] = await db.query(`
      SELECT COUNT(*) as count 
      FROM absensi 
      WHERE krs_id = ? 
        AND keterangan != 'h'
    `, [krs.krs_id]);

    const [[materiHariIniCount]] = await db.query(`
      SELECT COUNT(*) as count
      FROM krs_detail_materi kdm
      JOIN materi m ON kdm.materi_id = m.materi_id
      WHERE kdm.krs_id = ?
        AND DATE(m.created_at) = ?
    `, [krs.krs_id, todayDateString]);

    // 3. Ambil materi hari ini (3 terbaru)
    const [materiHariIni] = await db.query(`
      SELECT 
        m.materi_id,
        m.nama_materi, 
        m.uraian, 
        m.lampiran,
        mp.nama_mapel,
        m.created_at
      FROM krs_detail_materi kdm
      JOIN materi m ON kdm.materi_id = m.materi_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id AND kdm.mapel_id = kd.mapel_id
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      WHERE kdm.krs_id = ?
        AND DATE(m.created_at) = ?
      ORDER BY m.created_at DESC
      LIMIT 3
    `, [krs.krs_id, todayDateString]);

    // 4. Ambil tugas terbaru (tanpa data guru)
    const [tugasTerbaru] = await db.query(`
      SELECT 
        t.tugas_id,
        t.judul,
        t.deskripsi,
        t.lampiran AS lampiran_tugas,
        t.tenggat_kumpul,
        t.created_at,
        mp.nama_mapel,
        kdm.file_jawaban,
        kdm.tanggal_pengumpulan,
        kdm.nilai,
        kdm.uraian AS uraian_jawaban
      FROM tugas t
      JOIN krs_detail_materi kdm ON t.tugas_id = kdm.tugas_id
      JOIN krs_detail kd ON kdm.krs_id = kd.krs_id AND kdm.mapel_id = kd.mapel_id
      JOIN mapel mp ON kd.mapel_id = mp.mapel_id
      WHERE kdm.krs_id = ?
        AND t.created_at >= ?
      ORDER BY t.created_at DESC
      LIMIT 3
    `, [krs.krs_id, threeDaysAgo]);

    // Format tugas
    const tugasTerbaruFormatted = tugasTerbaru.map(tugas => {
      let status = 'Belum Dikerjakan';
      if (tugas.tanggal_pengumpulan) {
        status = tugas.tanggal_pengumpulan > tugas.tenggat_kumpul ? 'Terlambat' : 'Tepat Waktu';
      } else if (tugas.tenggat_kumpul < today) {
        status = 'Melewati Tenggat';
      }
      return {
        id: tugas.tugas_id,
        judul: tugas.judul,
        deskripsi: tugas.deskripsi,
        mapel: tugas.nama_mapel,
        lampiran_guru: tugas.lampiran_tugas,
        tenggat_kumpul: tugas.tenggat_kumpul,
        dikumpulkan_pada: tugas.tanggal_pengumpulan,
        file_jawaban: tugas.file_jawaban,
        uraian_jawaban: tugas.uraian_jawaban,
        nilai: tugas.nilai,
        status: status,
        dibuat_pada: tugas.created_at
      };
    });

    // 5. Ambil kelas hari ini (tanpa data guru)
    const [kelasHariIni] = await db.query(`
      SELECT 
        m.nama_mapel,
        mj.start,
        mj.finish,
        j.ruangan
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      WHERE j.kelas_id = ?
        AND j.hari = ?
      ORDER BY mj.start ASC
    `, [krs.kelas_id, hariIni]);

    // 6. Response akhir
    res.status(200).json({
      message: 'Ringkasan dashboard siswa berhasil diambil',
      status: 200,
      data: {
        ringkasan: {
          tugas_belum_dikerjakan: tugasBelumDikerjakan.count,
          tugas_terlambat: tugasTerlambat.count + tugasMelewatiTenggat.count,
          absensi_tidak_hadir: absensiTidakHadir.count,
          materi_hari_ini: materiHariIniCount.count
        },
        materi_hari_ini: materiHariIni,
        tugas_terbaru: tugasTerbaruFormatted,
        kelas_hari_ini: kelasHariIni.map(kelas => ({
          nama_mapel: kelas.nama_mapel,
          jam: `${kelas.start} - ${kelas.finish}`,
          ruangan: kelas.ruangan
        }))
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil ringkasan dashboard siswa',
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

const getStatistikNilaiSiswa = async (req, res) => {
  const userId = req.user.userId; // ID user dari token
  const { tahun_akademik_id } = req.params; // ID tahun akademik dari parameter

  try {
    // 1. Ambil data siswa berdasarkan user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil KRS siswa untuk tahun akademik tertentu
    const [krsList] = await db.query(`
      SELECT k.krs_id, k.kelas_id, k.siswa_nis, k.created_at
      FROM krs k
      JOIN kelas kl ON k.kelas_id = kl.kelas_id
      WHERE k.siswa_nis = ?
        AND kl.tahun_akademik_id = ?
    `, [siswa.nis, tahun_akademik_id]);

    if (krsList.length === 0) {
      return res.status(404).json({ 
        message: 'Data KRS tidak ditemukan untuk tahun akademik ini' 
      });
    }

    // 3. Ambil semua nilai dari krs_detail untuk KRS yang ditemukan
    const [nilaiList] = await db.query(`
      SELECT 
        kd.mapel_id,
        m.nama_mapel,
        kd.nilai,
        kd.keterampilan,
        kd.kkm,
        ROUND((kd.nilai + kd.keterampilan) / 2, 2) AS nilai_akhir,
        CASE 
          WHEN (kd.nilai + kd.keterampilan) / 2 >= kd.kkm THEN 'Tuntas'
          ELSE 'Belum Tuntas'
        END AS status,
        kd.created_at
      FROM krs_detail kd
      JOIN mapel m ON kd.mapel_id = m.mapel_id
      WHERE kd.krs_id IN (?)
      ORDER BY m.nama_mapel ASC
    `, [krsList.map(krs => krs.krs_id)]);

    // 4. Hitung statistik umum
    let totalMapel = nilaiList.length;
    let totalTuntas = nilaiList.filter(n => n.status === 'Tuntas').length;
    let totalBelumTuntas = totalMapel - totalTuntas;
    let rataRataNilai = 0;
    let rataRataKeterampilan = 0;
    let rataRataAkhir = 0;

    if (totalMapel > 0) {
      rataRataNilai = nilaiList.reduce((sum, n) => sum + n.nilai, 0) / totalMapel;
      rataRataKeterampilan = nilaiList.reduce((sum, n) => sum + n.keterampilan, 0) / totalMapel;
      rataRataAkhir = nilaiList.reduce((sum, n) => sum + n.nilai_akhir, 0) / totalMapel;
    }

    // 5. Format response
    res.status(200).json({
      message: 'Statistik nilai siswa berhasil diambil',
      status: 200,
      data: {
        tahun_akademik_id,
        statistik_umum: {
          total_mapel: totalMapel,
          total_tuntas: totalTuntas,
          total_belum_tuntas: totalBelumTuntas,
          rata_rata_nilai: parseFloat(rataRataNilai.toFixed(2)),
          rata_rata_keterampilan: parseFloat(rataRataKeterampilan.toFixed(2)),
          rata_rata_nilai_akhir: parseFloat(rataRataAkhir.toFixed(2))
        },
        detail_nilai: nilaiList.map(n => ({
          mapel_id: n.mapel_id,
          nama_mapel: n.nama_mapel,
          nilai_pengetahuan: n.nilai,
          nilai_keterampilan: n.keterampilan,
          nilai_akhir: n.nilai_akhir,
          kkm: n.kkm,
          status: n.status
        }))
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil statistik nilai siswa',
      error: err.message
    });
  }
};

const getDetailKelas = async (req, res) => {
  const userId = req.user.userId; // ID user dari token

  try {
    // 1. Ambil data siswa berdasarkan user ID
    const [[siswa]] = await db.query('SELECT nis FROM siswa WHERE user_id = ?', [userId]);
    if (!siswa) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // 2. Ambil data KRS terbaru siswa
    const [[krs]] = await db.query(`
      SELECT k.krs_id, k.kelas_id, k.created_at
      FROM krs k
      WHERE k.siswa_nis = ?
      ORDER BY k.created_at DESC
      LIMIT 1
    `, [siswa.nis]);

    if (!krs) {
      return res.status(404).json({ message: 'Siswa belum terdaftar di kelas manapun' });
    }

    // 3. Ambil detail kelas
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
        g.nama_guru AS wali_kelas,
        g.foto_profil AS foto_wali_kelas
      FROM kelas kl
      JOIN tahun_akademik ta ON kl.tahun_akademik_id = ta.tahun_akademik_id
      JOIN kurikulum kr ON kl.kurikulum_id = kr.kurikulum_id
      LEFT JOIN guru g ON kl.guru_nip = g.nip
      WHERE kl.kelas_id = ?
    `, [krs.kelas_id]);

    if (!kelas) {
      return res.status(404).json({ message: 'Data kelas tidak ditemukan' });
    }

    // 4. Format response
    res.status(200).json({
      message: 'Detail kelas berhasil diambil',
      status: 200,
      data: {
        id: kelas.kelas_id,
        nama_kelas: kelas.nama_kelas,
        tingkat: kelas.tingkat,
        jenjang: kelas.jenjang,
        tahun_akademik: {
          id: kelas.tahun_akademik_id,
          periode: `${new Date(kelas.tahun_mulai).getFullYear()}/${new Date(kelas.tahun_berakhir).getFullYear()}`,
          tahun_mulai: kelas.tahun_mulai,
          tahun_berakhir: kelas.tahun_berakhir,
          status: new Date() >= new Date(kelas.tahun_berakhir) ? 'Selesai' : 'Aktif'
        },
        kurikulum: kelas.nama_kurikulum,
        wali_kelas: {
          nama: kelas.wali_kelas,
          foto_profil: kelas.foto_wali_kelas
        }
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengambil detail kelas',
      error: err.message
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

    // 3. Ambil semua nilai
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

module.exports = {getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa, editTugasSiswa, getBeritaById, getDashboardRingkasanSiswa, getJadwalSiswabyhari, getMateriHariIni, getStatistikNilaiSiswa, getDetailKelas, getDetailRaporSiswa, downloadRaporPdf  };

