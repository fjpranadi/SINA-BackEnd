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
  const userId = req.user.userId;
  const { nis, keterangan, uraian, tanggal_absensi, password } = req.body;
  const suratFile = req.file;

  if (!nis || !keterangan || !uraian || !tanggal_absensi || !password) {
    return res.status(400).json({ 
      message: 'Semua field wajib diisi (termasuk password)' 
    });
  }

  if (!['i', 's'].includes(keterangan)) {
    return res.status(400).json({ message: 'Keterangan harus "i" (izin) atau "s" (sakit)' });
  }

  try {
    // 1. Verifikasi ortu
    const [ortuResult] = await db.query('CALL ortu_profile(?)', [userId]);
    const ortu = ortuResult[0]?.[0];

    if (!ortu || !ortu.nik) {
      return res.status(403).json({ message: 'Data orang tua tidak ditemukan' });
    }

    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const anak = anakList[0]?.find(a => a.nis === nis);
    if (!anak) {
      return res.status(403).json({ message: 'Siswa tidak ditemukan atau tidak terhubung dengan ortu ini' });
    }

    // 2. Validasi password
    const [pwResult] = await db.query('CALL sp_read_password(?)', [userId]);
    const user = pwResult[0]?.[0];

    if (!user || !user.password) {
      return res.status(403).json({ message: 'Password pengguna tidak ditemukan' });
    }

    const dbPassword = user.password;
    const isHashed = dbPassword.startsWith('$2b$');

    let isValidPassword = false;
    if (isHashed) {
      isValidPassword = await bcrypt.compare(password, dbPassword);
    } else {
      isValidPassword = password === dbPassword;
    }

    if (!isValidPassword) {
      return res.status(403).json({ message: 'Password tidak sesuai' });
    }

    // 3. Ambil KRS
    const [krsData] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);
    const krs_id = krsData[0]?.[0]?.krs_id;

    if (!krs_id) {
      return res.status(404).json({ message: 'KRS siswa tidak ditemukan' });
    }

    const absensi_id = `abs-${Date.now()}`;
    const created_at = new Date();

    await db.query(`
      INSERT INTO absensi (absensi_id, krs_id, keterangan, tanggal, uraian, surat, status_surat, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'menunggu', ?)
    `, [
      absensi_id,
      krs_id,
      keterangan,
      tanggal_absensi,
      uraian,
      suratFile ? suratFile.filename : null,
      created_at
    ]);

    return res.status(201).json({
      message: 'Surat izin berhasil diajukan',
      data: {
        absensi_id,
        tanggal: tanggal_absensi,
        keterangan,
        status_surat: 'menunggu',
        file_surat: suratFile ? `/Upload/surat/${suratFile.filename}` : null
      }
    });

  } catch (err) {
    console.error('Error saat mengajukan surat izin:', err);

    if (suratFile && fs.existsSync(suratFile.path)) {
      fs.unlinkSync(suratFile.path);
    }

    return res.status(500).json({
      message: 'Terjadi kesalahan saat mengajukan surat izin',
      error: err.message
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
  const userId = req.user.userId;
  const { nis } = req.params;

  try {
    // 1. Verifikasi ortu dan siswa
    const [[ortuResult]] = await db.query('CALL ortu_profile(?)', [userId]);
    const ortu = ortuResult[0];

    if (!ortu || !ortu.nik) {
      return res.status(403).json({ message: 'Data ortu tidak ditemukan' });
    }

    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const anak = anakList[0].find(a => a.nis === nis);

    if (!anak) {
      return res.status(403).json({ message: 'Siswa tidak ditemukan atau tidak terkait ortu ini' });
    }

    // 2. Ambil krs_id terbaru (asumsi 1 aktif)
    const [krsRows] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);
    const krs_id = krsRows[0]?.[0]?.krs_id;

    if (!krs_id) {
      return res.status(404).json({ message: 'Data KRS siswa tidak ditemukan' });
    }

    // 3. Ambil riwayat absensi via SP
    const [riwayatRows] = await db.query('CALL sp_read_riwayat_absen_siswa(?)', [krs_id]);
    const riwayat = riwayatRows[0] || [];

    // 4. Format hasil
    const hasil = riwayat.map(item => ({
      tanggal: item.tanggal,
      status: item.keterangan === 's' ? 'Sakit'
             : item.keterangan === 'i' ? 'Izin'
             : item.keterangan === 'a' ? 'Alpha'
             : 'Tidak Diketahui',
      surat: item.surat ? `/uploads/surat/${item.surat}` : null
    }));

    return res.status(200).json({
      message: `Riwayat absensi siswa ${anak.nama_siswa} berhasil diambil`,
      data: hasil
    });

  } catch (err) {
    console.error('Gagal mengambil riwayat absensi siswa:', err);
    res.status(500).json({
      message: 'Terjadi kesalahan saat mengambil riwayat absensi siswa',
      error: err.message
    });
  }
};


const getRekapAbsensiBySemester = async (req, res) => {
  const userId = req.user.userId;
  const { nis, krs_id } = req.params;

  try {
    // Validasi ortu
    const [ortuResult] = await db.query('CALL ortu_profile(?)', [userId]);
    const ortu = ortuResult[0]?.[0];
    if (!ortu || !ortu.nik) {
      return res.status(403).json({ message: 'Data ortu tidak ditemukan' });
    }

    // Validasi siswa milik ortu
    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const anak = anakList[0].find(a => a.nis === nis);
    if (!anak) {
      return res.status(403).json({ message: 'Siswa tidak ditemukan atau tidak terkait ortu ini' });
    }

    // Ambil rekap absen
    const [rekapRows] = await db.query('CALL sp_rekap_absen_siswa(?)', [krs_id]);
    const rekap = rekapRows[0]?.[0] || {};
    console.log(rekap);

    return res.status(200).json({
      message: 'Rekap absensi berhasil diambil',
      data: {
        nama: anak.nama_siswa,
        nis,
        krs_id,
        absensi: {
          hadir: rekap.hadir || 0,
          izin: rekap.izin || 0,
          sakit: rekap.sakit || 0,
          alpha: rekap.alpha || 0
        }
      }
    });

  } catch (err) {
    console.error('Gagal mengambil rekap absensi:', err);
    return res.status(500).json({
      message: 'Gagal mengambil rekap absensi',
      error: err.message
    });
  }
};

const getStatistikNilaiSiswa = async (req, res) => {
  const userId = req.user.userId;
  const { nis } = req.params;
  const filterKelas = req.query.kelas; // e.g. ?kelas=VII/2

  try {
    // 1. Validasi apakah siswa ini milik ortu
    const [[checkAnak]] = await db.query(`
      SELECT s.nama_siswa FROM siswa_ortu so
      JOIN siswa s ON so.nis = s.nis
      JOIN ortu o ON so.nik = o.nik
      WHERE o.user_id = ? AND s.nis = ?
    `, [userId, nis]);

    if (!checkAnak) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses ke siswa ini' });
    }

    // 2. Ambil data statistik nilai
    const [statistikResult] = await db.query(`CALL sp_read_statistik_nilai(?)`, [nis]);
    const dataNilai = statistikResult[0] || [];

    // 3. Siapkan daftar kelas (format: tingkat/semester)
    const kelasTersedia = [
      ...new Set(dataNilai.map(d => `${d.tingkat}/${d.semester}`))
    ];

    // 4. Filter jika ada query ?kelas=
    const filtered = filterKelas
      ? dataNilai.filter(d => `${d.tingkat}/${d.semester}` === filterKelas)
      : dataNilai;

    // 5. Format hasil
    const formatted = filtered.map(d => ({
      kelas: `${d.tingkat}/${d.semester}`,
      mapel: d.nama_mapel,
      nilai: d.nilai
    }));

    return res.status(200).json({
      siswa: checkAnak.nama_siswa,
      kelas_tersedia: kelasTersedia,
      data: formatted
    });

  } catch (error) {
    console.error('Error statistik nilai:', error);
    return res.status(500).json({
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

const ubahPasswordOrtu = async (req, res) => {
  const userId = req.user.userId;
  const { password_lama, password_baru, konfirmasi_password } = req.body;

  try {
    // Validasi: Semua field wajib diisi
    if (!password_lama || !password_baru || !konfirmasi_password) {
      return res.status(400).json({ message: 'Semua kolom password harus diisi' });
    }

    // Validasi: Password baru dan konfirmasi harus sama
    if (password_baru !== konfirmasi_password) {
      return res.status(400).json({ message: 'Konfirmasi password tidak cocok' });
    }

    // Ambil password lama dari database
    const [pwResult] = await db.query('CALL sp_read_password(?)', [userId]);
    const user = pwResult[0]?.[0]; // akses objek pertama dari result set

    if (!user) {
      return res.status(404).json({ message: 'Data pengguna tidak ditemukan' });
    }

    const passwordAsli = user.password;

    if (!passwordAsli) {
      return res.status(404).json({ message: 'Data pengguna tidak ditemukan' });
    }

    // Cek apakah password lama cocok
    const cocok = await bcrypt.compare(password_lama, passwordAsli);
    if (!cocok) {
      return res.status(403).json({ message: 'Password lama tidak sesuai' });
    }

    // Hash password baru
    const hashBaru = await bcrypt.hash(password_baru, 10);

    // Update password ke database
    await db.query('CALL sp_update_user(?, NULL, NULL, ?)', [userId, hashBaru]);

    return res.status(200).json({ message: 'Password berhasil diperbarui' });
  } catch (err) {
    console.error('Gagal mengubah password:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan saat mengubah password', error: err.message });
  }
};

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
  ubahPasswordOrtu, 
  getRekapAbsensiBySemester,
  getDetailRaporSiswa};