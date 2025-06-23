const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project
const fs = require('fs');
const path = require('path');


const getBiodataOrtu = async (req, res) => {
  const userId = req.user.userId; // diambil dari JWT

  try {
    const [rows] = await db.query(
      'SELECT * FROM ortu WHERE user_id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data orang tua tidak ditemukan.' });
    }

    return res.status(200).json({ data: rows[0] });
  } catch (error) {
    console.error('Error saat mengambil data orang tua:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
};

const getSiswaByOrtu = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil NIK ortu berdasarkan user_id
    const [ortuRows] = await db.query(
      'SELECT nik FROM ortu WHERE user_id = ?',
      [userId]
    );

    if (ortuRows.length === 0) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan.' });
    }

    const nikOrtu = ortuRows[0].nik;

    // 2. Ambil data siswa + krs
    const [siswaRows] = await db.query(`
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        s.no_telepon,
        s.foto_profil,
        k.krs_id
      FROM siswa_ortu so
      LEFT JOIN siswa s ON so.nis = s.nis
      LEFT JOIN krs k ON s.nis = k.siswa_nis
      WHERE so.nik = ?
    `, [nikOrtu]);

    if (siswaRows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada siswa yang terhubung dengan ortu ini.' });
    }

    return res.status(200).json({ data: siswaRows });
  } catch (error) {
    console.error('Gagal mengambil data siswa:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
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

const editBiodataOrtu = async (req, res) => {
  const userId = req.user.userId;
  const {
    nik,
    nama_ortu,
    alamat,
    status_ortu,
    pekerjaan,
    tempat_lahir_ortu,
    tanggal_lahir_ortu,
    no_telepon
  } = req.body;

  // Handle file upload if exists
  const foto_profil = req.file ? req.file.filename : null;

  try {
    // 1. Get current data
    const [currentData] = await db.query(
      'SELECT * FROM ortu WHERE user_id = ?',
      [userId]
    );

    if (currentData.length === 0) {
      return res.status(404).json({ message: 'Data orang tua tidak ditemukan.' });
    }

    const oldData = currentData[0];

    // 2. Prepare update data
    const updateData = {
      nik: nik || oldData.nik,
      nama_ortu: nama_ortu || oldData.nama_ortu,
      alamat: alamat || oldData.alamat,
      status_ortu: status_ortu || oldData.status_ortu,
      pekerjaan: pekerjaan || oldData.pekerjaan,
      tempat_lahir_ortu: tempat_lahir_ortu || oldData.tempat_lahir_ortu,
      tanggal_lahir_ortu: tanggal_lahir_ortu || oldData.tanggal_lahir_ortu,
      no_telepon: no_telepon || oldData.no_telepon,
      foto_profil: foto_profil || oldData.foto_profil
    };

    // 3. Check for changes and prepare success messages
    const successMessages = [];
    
    if (nik && nik !== oldData.nik) successMessages.push("NIK berhasil diubah");
    if (nama_ortu && nama_ortu !== oldData.nama_ortu) successMessages.push("Nama berhasil diubah");
    if (alamat && alamat !== oldData.alamat) successMessages.push("Alamat berhasil diubah");
    if (status_ortu && status_ortu !== oldData.status_ortu) successMessages.push("Status berhasil diubah");
    if (pekerjaan && pekerjaan !== oldData.pekerjaan) successMessages.push("Pekerjaan berhasil diubah");
    if (tempat_lahir_ortu && tempat_lahir_ortu !== oldData.tempat_lahir_ortu) successMessages.push("Tempat lahir berhasil diubah");
    if (tanggal_lahir_ortu && tanggal_lahir_ortu !== oldData.tanggal_lahir_ortu) successMessages.push("Tanggal lahir berhasil diubah");
    if (no_telepon && no_telepon !== oldData.no_telepon) successMessages.push("Nomor telepon berhasil diubah");
    if (foto_profil) successMessages.push("Foto profil berhasil diubah");

    if (successMessages.length === 0) {
      return res.status(200).json({ 
        message: 'Tidak ada perubahan data.'
      });
    }

    // 4. Perform update
    await db.query(
      `UPDATE ortu SET 
        nik = ?,
        nama_ortu = ?,
        alamat = ?,
        status_ortu = ?,
        pekerjaan = ?,
        tempat_lahir_ortu = ?,
        tanggal_lahir_ortu = ?,
        no_telepon = ?,
        foto_profil = ?
      WHERE user_id = ?`,
      [
        updateData.nik,
        updateData.nama_ortu,
        updateData.alamat,
        updateData.status_ortu,
        updateData.pekerjaan,
        updateData.tempat_lahir_ortu,
        updateData.tanggal_lahir_ortu,
        updateData.no_telepon,
        updateData.foto_profil,
        userId
      ]
    );

    return res.status(200).json({ 
      messages: successMessages
    });

  } catch (error) {
    console.error('Error saat mengupdate biodata ortu:', error);
    
    // Delete uploaded file if error occurs
    if (foto_profil && fs.existsSync(foto_profil)) {
      fs.unlinkSync(foto_profil);
    }
    
    return res.status(500).json({ 
      message: 'Terjadi kesalahan server.',
      error: error.message 
    });
  }
};

// Tampilkan semua surat izin yang diajukan ortu untuk siswa
const getRiwayatSuratIzin = async (req, res) => {
  const userId = req.user.userId;
  const { nis } = req.params;

  try {
    // Verifikasi ortu memiliki akses ke siswa
    const [ortuData] = await db.query(`
      SELECT o.nik 
      FROM ortu o
      JOIN siswa_ortu so ON o.nik = so.nik
      WHERE o.user_id = ? AND so.nis = ?
    `, [userId, nis]);

    if (ortuData.length === 0) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke siswa ini.' });
    }

    // Ambil riwayat surat izin
    const [suratRows] = await db.query(`
      SELECT 
        a.absensi_id,
        a.keterangan,
        a.tanggal,
        a.status_surat
      FROM absensi a
      JOIN krs k ON a.krs_id = k.krs_id
      WHERE k.siswa_nis = ?
        AND a.surat IS NOT NULL
      ORDER BY a.created_at DESC
    `, [nis]);

    const formatted = suratRows.map(item => ({
      id: item.absensi_id,
      jenis: item.keterangan === 's' ? 'Sakit' : 'Izin',
      tanggal: item.tanggal,
      status: item.status_surat === 'terima' ? 'Disetujui' :
              item.status_surat === 'tolak' ? 'Ditolak' :
              'Diproses'
    }));

    res.status(200).json({
      message: 'Riwayat surat izin berhasil diambil',
      data: formatted
    });

  } catch (error) {
    console.error('Gagal mengambil riwayat surat izin:', error);
    res.status(500).json({ message: 'Gagal mengambil riwayat surat izin', error: error.message });
  }
};


// Tampilkan detail surat izin berdasarkan absensi_id
const getDetailSuratIzin = async (req, res) => {
  const userId = req.user.userId;
  const { absensi_id } = req.params;

  try {
    const [detailRows] = await db.query(`
      SELECT 
        a.absensi_id,
        a.keterangan,
        a.tanggal,
        a.uraian,
        a.surat,
        a.status_surat,
        k.siswa_nis,
        s.nama_siswa
      FROM absensi a
      JOIN krs k ON a.krs_id = k.krs_id
      JOIN siswa s ON k.siswa_nis = s.nis
      JOIN siswa_ortu so ON s.nis = so.nis
      JOIN ortu o ON so.nik = o.nik
      WHERE a.absensi_id = ? AND o.user_id = ?
    `, [absensi_id, userId]);

    if (detailRows.length === 0) {
      return res.status(403).json({ message: 'Data surat izin tidak ditemukan atau bukan milik Anda.' });
    }

    const surat = detailRows[0];

    res.status(200).json({
      message: 'Detail surat izin berhasil diambil',
      data: {
        absensi_id: surat.absensi_id,
        nama_siswa: surat.nama_siswa,
        tanggal: surat.tanggal,
        jenis: surat.keterangan === 's' ? 'Sakit' : 'Izin',
        uraian: surat.uraian,
        status: surat.status_surat === 'terima' ? 'Disetujui' :
                surat.status_surat === 'tolak' ? 'Ditolak' :
                'Diproses',
        surat_url: surat.surat ? `/Upload/surat/${surat.surat}` : null
      }
    });

  } catch (error) {
    console.error('Gagal mengambil detail surat izin:', error);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil detail surat izin', error: error.message });
  }
};

// controller/dashboardController.js
const submitSuratIzin = async (req, res) => {
  const userId = req.user.userId; // ID orang tua dari JWT
  const { nis, keterangan, uraian, tanggal_absensi } = req.body;
  const suratFile = req.file; // File surat yang diupload

  // Validasi input
  if (!nis || !keterangan || !uraian || !tanggal_absensi) {
    return res.status(400).json({ 
      message: 'Semua field harus diisi (nis, keterangan, uraian, tanggal_absensi)' 
    });
  }

  if (!['i', 's'].includes(keterangan)) {
    return res.status(400).json({ 
      message: 'Keterangan harus "i" (izin) atau "s" (sakit)' 
    });
  }

  try {
    // 1. Verifikasi bahwa siswa tersebut adalah anak dari orang tua yang login
    const [ortuData] = await db.query(
      `SELECT o.nik 
       FROM ortu o
       JOIN siswa_ortu so ON o.nik = so.nik
       WHERE o.user_id = ? AND so.nis = ?`,
      [userId, nis]
    );

    if (ortuData.length === 0) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke siswa ini atau data tidak ditemukan' 
      });
    }

    // 2. Cari KRS siswa untuk tahun ajaran saat ini
    const [krsData] = await db.query(
      `SELECT k.krs_id 
       FROM krs k
       WHERE k.siswa_nis = ? 
       ORDER BY k.created_at DESC LIMIT 1`,
      [nis]
    );

    if (krsData.length === 0) {
      return res.status(404).json({ 
        message: 'Data KRS siswa tidak ditemukan' 
      });
    }

    const krs_id = krsData[0].krs_id;

    // 3. Buat data absensi dengan status surat "menunggu"
    const absensi_id = `abs-${Date.now()}`;
    const created_at = new Date();

    await db.query(
      `INSERT INTO absensi 
       (absensi_id, krs_id, keterangan, tanggal, uraian, surat, status_surat, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, 'menunggu', ?)`,
      [
        absensi_id,
        krs_id,
        keterangan,
        tanggal_absensi,
        uraian,
        suratFile ? suratFile.filename : null,
        created_at
      ]
    );

    return res.status(201).json({
      message: 'Surat izin berhasil diajukan',
      data: {
        absensi_id,
        tanggal: tanggal_absensi,
        keterangan,
        status_surat: 'menunggu'
      }
    });

  } catch (error) {
    console.error('Error saat mengajukan surat izin:', error);
    
    // Hapus file yang sudah diupload jika terjadi error
    if (suratFile && fs.existsSync(suratFile.path)) {
      fs.unlinkSync(suratFile.path);
    }
    
    return res.status(500).json({ 
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

const getDashboardCountOrtu = async (req, res) => {
  const userId = req.user.userId; // ID orang tua dari JWT
  const { nis } = req.params; // NIS siswa yang ingin dilihat

  try {
    // 1. Verifikasi bahwa siswa tersebut adalah anak dari orang tua yang login
    const [ortuData] = await db.query(
      `SELECT o.nik 
       FROM ortu o
       JOIN siswa_ortu so ON o.nik = so.nik
       WHERE o.user_id = ? AND so.nis = ?`,
      [userId, nis]
    );

    if (ortuData.length === 0) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke siswa ini atau data tidak ditemukan' 
      });
    }

    // 2. Ambil data KRS siswa terbaru
    const [[krs]] = await db.query(
      `SELECT krs_id, kelas_id 
       FROM krs 
       WHERE siswa_nis = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [nis]
    );

    if (!krs) {
      return res.status(404).json({ 
        message: 'Data KRS siswa tidak ditemukan' 
      });
    }

    const today = new Date();
    const todayDateString = today.toISOString().split('T')[0];

    // 3. Hitung statistik untuk dashboard
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

    // 4. Ambil status kehadiran terbaru
    const [[statusKehadiran]] = await db.query(`
      SELECT a.keterangan
      FROM absensi a
      WHERE a.krs_id = ?
      ORDER BY a.tanggal DESC
      LIMIT 1
    `, [krs.krs_id]);

    // 5. Ambil nama siswa untuk notifikasi
    const [[siswa]] = await db.query(
      `SELECT nama_siswa FROM siswa WHERE nis = ?`,
      [nis]
    );

    // 6. Response
    res.status(200).json({
      message: 'Dashboard orang tua berhasil diambil',
      data: {
        ringkasan: {
          tugas_belum_dikerjakan: tugasBelumDikerjakan.count,
          tugas_terlambat: tugasTerlambat.count,
          absensi_tidak_hadir: absensiTidakHadir.count,
          materi_hari_ini: materiHariIniCount.count
        },
        notifikasi_anak: {
          nama: siswa.nama_siswa,
          status_kehadiran: statusKehadiran ? 
            (statusKehadiran.keterangan === 'h' ? 'Hadir' : 
             statusKehadiran.keterangan === 'i' ? 'Izin' : 
             statusKehadiran.keterangan === 's' ? 'Sakit' : 'Tidak Hadir') 
            : 'Belum ada data'
        }
      }
    });

  } catch (error) {
    console.error('Error saat mengambil dashboard ortu:', error);
    return res.status(500).json({ 
      message: 'Terjadi kesalahan server',
      error: error.message 
    });
  }
};

const getJadwalSiswaOrtu = async (req, res) => {
  const userId = req.user.userId;
  const { nis } = req.params;

  try {
    // 1. Verifikasi akses ortu ke siswa
    const [ortuData] = await db.query(
      `SELECT o.nik 
       FROM ortu o
       JOIN siswa_ortu so ON o.nik = so.nik
       WHERE o.user_id = ? AND so.nis = ?`,
      [userId, nis]
    );

    if (ortuData.length === 0) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke siswa ini atau data tidak ditemukan' 
      });
    }

    // 2. Ambil data jadwal siswa - QUERY DIUBAH
    const [jadwalResult] = await db.query(`
      SELECT 
        j.hari, 
        mj.start, 
        mj.finish, 
        m.nama_mapel, 
        COALESCE(g.nama_guru, 'Belum ada guru') AS nama_guru,
        j.ruangan
      FROM krs k
      JOIN jadwal j ON k.kelas_id = j.kelas_id
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      LEFT JOIN krs_detail kd ON (
        j.mapel_id = kd.mapel_id 
        AND k.krs_id = kd.krs_id
      )
      LEFT JOIN guru g ON kd.guru_nip = g.nip
      WHERE k.siswa_nis = ?
        AND k.status = 'aktif'
      ORDER BY 
        FIELD(j.hari, 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'),
        mj.start ASC
    `, [nis]);

    // 3. Ambil nama siswa
    const [[siswa]] = await db.query(
      `SELECT nama_siswa FROM siswa WHERE nis = ?`,
      [nis]
    );

    if (!siswa) {
      return res.status(404).json({ 
        message: 'Data siswa tidak ditemukan' 
      });
    }

    // 4. Format response sesuai contoh yang diinginkan
    res.status(200).json({
      message: `Jadwal siswa ${siswa.nama_siswa} berhasil diambil`,
      status: 200,
      jadwal_pelajaran: jadwalResult.map(jadwal => ({
        hari: jadwal.hari.toLowerCase(), // Format huruf kecil seperti contoh
        start: jadwal.start,
        finish: jadwal.finish,
        nama_mapel: jadwal.nama_mapel,
        nama_guru: jadwal.nama_guru
      }))
    });

  } catch (err) {
    console.error('Error detail:', err);
    res.status(500).json({ 
      message: 'Gagal mengambil jadwal siswa',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
const getJadwalSiswaOrtuByHari = async (req, res) => {
  const userId = req.user.userId; // ID orang tua dari JWT
  const { nis, hari } = req.params; // NIS dan hari yang ingin dilihat

  try {
    // 1. Verifikasi bahwa siswa tersebut adalah anak dari orang tua yang login
    const [ortuData] = await db.query(
      `SELECT o.nik 
       FROM ortu o
       JOIN siswa_ortu so ON o.nik = so.nik
       WHERE o.user_id = ? AND so.nis = ?`,
      [userId, nis]
    );

    if (ortuData.length === 0) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke siswa ini atau data tidak ditemukan' 
      });
    }

    // 2. Ambil data jadwal siswa untuk hari tertentu
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
          SELECT kelas_id FROM krs WHERE siswa_nis = ? ORDER BY created_at DESC LIMIT 1
        )
      )
      LEFT JOIN guru g ON kd.guru_nip = g.nip
      WHERE j.kelas_id = (
        SELECT kelas_id FROM krs WHERE siswa_nis = ? ORDER BY created_at DESC LIMIT 1
      )
      AND j.hari = ?
      ORDER BY mj.start ASC
    `, [nis, nis, hari]);

    // 3. Format response
    const formattedJadwal = jadwalResult.map(jadwal => ({
      jam: `${jadwal.start} - ${jadwal.finish}`,
      mata_pelajaran: jadwal.nama_mapel,
      guru: jadwal.nama_guru,
      ruangan: jadwal.ruangan
    }));

    // 4. Ambil nama siswa untuk response
    const [[siswa]] = await db.query(
      `SELECT nama_siswa FROM siswa WHERE nis = ?`,
      [nis]
    );

    res.status(200).json({
      message: `Jadwal siswa ${siswa.nama_siswa} pada hari ${hari} berhasil diambil`,
      status: 200,
      data: {
        hari: hari,
        jadwal: formattedJadwal
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Gagal mengambil jadwal siswa',
      error: err.message 
    });
  }
};

const getRiwayatAbsensiSiswa = async (req, res) => {
  const userId = req.user.userId; // ID orang tua dari JWT
  const { nis } = req.params; // NIS siswa yang ingin dilihat

  try {
    // 1. Verifikasi bahwa siswa tersebut adalah anak dari orang tua yang login
    const [ortuData] = await db.query(
      `SELECT o.nik 
       FROM ortu o
       JOIN siswa_ortu so ON o.nik = so.nik
       WHERE o.user_id = ? AND so.nis = ?`,
      [userId, nis]
    );

    if (ortuData.length === 0) {
      return res.status(403).json({ 
        message: 'Anda tidak memiliki akses ke siswa ini atau data tidak ditemukan' 
      });
    }

    // 2. Ambil riwayat absensi siswa
    const [absensiResult] = await db.query(`
      SELECT 
        a.absensi_id,
        a.tanggal,
        CASE 
          WHEN a.keterangan = 'h' THEN 'Hadir'
          WHEN a.keterangan = 'i' THEN 'Izin'
          WHEN a.keterangan = 's' THEN 'Sakit'
          WHEN a.keterangan = 'a' THEN 'Alpha'
        END AS status_kehadiran,
        a.uraian,
        a.surat,
        a.status_surat,
        m.nama_mapel,
        j.hari,
        mj.start,
        mj.finish,
        g.nama_guru,
        k.nama_kelas
      FROM absensi a
      JOIN jadwal j ON a.jadwal_id = j.jadwal_id
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      LEFT JOIN guru g ON a.guru_nip = g.nip
      JOIN krs krs ON a.krs_id = krs.krs_id
      JOIN kelas k ON krs.kelas_id = k.kelas_id
      WHERE krs.siswa_nis = ?
        AND a.keterangan IN ('a', 'i', 's')
      ORDER BY a.tanggal DESC
    `, [nis]);

    // 3. Ambil nama siswa untuk response
    const [[siswa]] = await db.query(
      `SELECT nama_siswa FROM siswa WHERE nis = ?`,
      [nis]
    );

    if (!siswa) {
      return res.status(404).json({ 
        message: 'Data siswa tidak ditemukan' 
      });
    }

    // 4. Format response
    const formattedResult = absensiResult.map(absensi => ({
      id: absensi.absensi_id,
      tanggal: absensi.tanggal,
      status: absensi.status_kehadiran,
      mata_pelajaran: absensi.nama_mapel,
      kelas: absensi.nama_kelas,
      jam: `${absensi.start} - ${absensi.finish}`,
      hari: absensi.hari,
      guru: absensi.nama_guru || 'Tidak tercatat',
      alasan: absensi.uraian || 'Tidak ada keterangan',
      surat: absensi.surat ? `/uploads/surat/${absensi.surat}` : null,
      status_surat: absensi.status_surat === 'terima' ? 'Diterima' : 
                   absensi.status_surat === 'tolak' ? 'Ditolak' : 'Menunggu'
    }));

    res.status(200).json({
      message: `Riwayat absensi siswa ${siswa.nama_siswa} berhasil diambil`,
      status: 200,
      data: formattedResult
    });

  } catch (err) {
    console.error('Error detail:', err);
    res.status(500).json({ 
      message: 'Gagal mengambil riwayat absensi siswa',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

const getStatistikNilaiSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { nis } = req.params;
  const kelasFilter = req.query.kelas; // optional filter by kelas

  console.log('🔎 Endpoint Statistik Dipanggil');
  console.log('User ID:', userId, 'NIS:', nis);
  
  try {
    // 1. Validasi siswa milik ortu
    const [[checkAnak]] = await db.query(
      `SELECT s.nama_siswa FROM siswa_ortu so
       JOIN siswa s ON so.nis = s.nis
       JOIN ortu o ON so.nik = o.nik
       WHERE o.user_id = ? AND s.nis = ?`,
      [userId, nis]
    );

    if (!checkAnak) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke siswa ini' });
    }

    // 2. Ambil data statistik nilai
    const [statistikResult] = await db.query(`CALL sp_read_statistik_nilai(?)`, [nis]);
    const nilaiStatistik = statistikResult[0] || [];

    // 3. Ambil daftar kelas yang pernah diikuti siswa
    const [kelasResult] = await db.query(`
      SELECT DISTINCT k.nama_kelas
      FROM krs kr
      JOIN kelas k ON kr.kelas_id = k.kelas_id
      WHERE kr.siswa_nis = ?
    `, [nis]);

    const kelasTersedia = kelasResult.map(k => k.nama_kelas);

    // 4. Filter nilai berdasarkan kelas (jika query ?kelas= disediakan)
    const dataFiltered = kelasFilter
      ? nilaiStatistik.filter(n => n.nama_kelas === kelasFilter)
      : nilaiStatistik;

    // 5. Format hasil untuk frontend
    const formattedData = dataFiltered.map(n => ({
      kelas: n.nama_kelas,
      mapel: n.nama_mapel,
      rerata: n.rerata
    }));

    res.status(200).json({
      siswa: checkAnak.nama_siswa,
      kelas_tersedia: kelasTersedia,
      data: formattedData
    });

  } catch (error) {
    console.error('Error statistik nilai:', error);
    res.status(500).json({ 
      message: 'Terjadi kesalahan saat mengambil data nilai', 
      error: error.message 
    });
  }
};

const getListRaporSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [ortuResult] = await db.query('CALL ortu_profile(?)', [userId]);
    const ortu = ortuResult[0][0];
    console.log('ORTU DATA:', ortu);

    if (!ortu || !ortu.nik) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan' });
    }

    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const hasil = [];

    for (const anak of anakList[0]) {
      const [kelasList] = await db.query('CALL sp_read_list_kelas_siswa(?)', [anak.nis]);

      hasil.push({
        nis: anak.nis,
        nama: anak.nama_siswa,
        riwayat_rapor: kelasList[0].map(k => ({
          krs_id: k.krs_id,
          nama_kelas: `${k.tingkat}/${k.semester}`
        }))
      });
    }


    return res.status(200).json({
      message: 'List rapor berhasil diambil',
      data: hasil
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Gagal mengambil list rapor', error: err.message });
  }
};


const getDetailRaporSiswa = async (req, res) => {
  const { krs_id } = req.params;
  const userId = req.user.userId;

  try {
    // 1. Ambil data ortu
    const [ortuResult] = await db.query('CALL ortu_profile(?)', [userId]);
    const ortu = ortuResult[0]?.[0];
    if (!ortu || !ortu.nik) {
      return res.status(403).json({ message: 'Data ortu tidak ditemukan' });
    }

    // 2. Ambil anak-anak dari ortu
    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    let anak = null;

    for (const a of anakList[0]) {
      const [kelasList] = await db.query('CALL sp_read_list_kelas_siswa(?)', [a.nis]);
      if (kelasList[0]?.find(k => k.krs_id === krs_id)) {
        anak = a;
        break;
      }
    }

    if (!anak) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke data rapor ini' });
    }

    // 3. Ambil info kelas dan semester
    const [kelasList] = await db.query('CALL sp_read_list_kelas_siswa(?)', [anak.nis]);
    const kelasInfo = kelasList[0].find(k => k.krs_id === krs_id);

    if (!kelasInfo) {
      return res.status(404).json({ message: 'Informasi kelas tidak ditemukan' });
    }

    // 4. Ambil daftar nilai
    const [nilaiResult] = await db.query('CALL sp_read_siswa_detail_krs(?)', [krs_id]);
    const nilaiList = nilaiResult[0];

    // 5. Format response
    return res.status(200).json({
      message: 'Detail rapor berhasil diambil',
      data: {
        krs_id,
        nama: anak.nama_siswa,
        kelas: `${kelasInfo.tingkat} ${kelasInfo.nama_kelas}`,
        semester: `${kelasInfo.semester}`,
        nilai: nilaiList.map(n => ({
          nama_mapel: n.nama_mapel,
          nilai: n.nilai,
          kategori: getKategori(n.nilai)
        }))
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil detail rapor', error: err.message });
  }
};

// Fungsi untuk mengategorikan nilai
function getKategori(nilai) {
  if (nilai >= 85) return 'A';
  if (nilai >= 75) return 'B';
  if (nilai >= 65) return 'C';
  return 'D';
}


module.exports = {
  getBiodataOrtu, 
  getSiswaByOrtu, 
  getBerita, 
  editBiodataOrtu, 
  getDashboardCountOrtu, 
  getJadwalSiswaOrtu, 
  getJadwalSiswaOrtuByHari, 
  submitSuratIzin, 
  getRiwayatAbsensiSiswa, 
  getStatistikNilaiSiswa, 
  getRiwayatSuratIzin, 
  getDetailSuratIzin, 
  getListRaporSiswa, 
  getDetailRaporSiswa};