const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt'; // Ganti ini di real project
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

    // 2. Ambil data siswa yang terhubung dengan NIK ortu, lalu join ke tabel siswa
    const [siswaRows] = await db.query(`
      SELECT 
        s.nis,
        s.nisn,
        s.nama_siswa,
        s.no_telepon,
        s.foto_profil
      FROM siswa_ortu so
      LEFT JOIN siswa s ON so.nis = s.nis
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

//perubahan mulai dari sini
// Fungsi untuk mengambil statistik nilai siswa

const getStatistikNilai = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil nik ortu
    const [[ortu]] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (!ortu) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan' });
    }

    const nik = ortu.nik;

    // 2. Ambil semua nis anak dari relasi ortu-siswa
    const [siswaList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [nik]);
    if (siswaList[0].length === 0) {
      return res.status(404).json({ message: 'Tidak ada anak yang terhubung dengan ortu ini' });
    }

    // 3. Ambil nilai masing-masing anak
    const hasil = [];

    for (const siswa of siswaList[0]) {
      const nis = siswa.nis;

      const [nilaiRows] = await db.query('CALL sp_read_statistik_nilai(?)', [nis]);
      hasil.push({
        nis,
        nama: siswa.nama_siswa,
        nilai: nilaiRows[0] || []
      });
    }

    return res.status(200).json({
      message: 'Statistik nilai semua anak berhasil diambil',
      status: 200,
      data: hasil
    });

  } catch (err) {
    console.error('❌ ERROR getSemuaStatistikNilaiAnak:', err);
    res.status(500).json({ message: 'Gagal mengambil statistik nilai', error: err.message });
  }
};


const getRekapAbsensi = async (req, res) => {
  const userId = req.user.userId;

  try {
    const [[ortu]] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (!ortu) return res.status(404).json({ message: 'Orang tua tidak ditemukan' });

    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const hasil = [];

    for (const anak of anakList[0]) {
      const nis = anak.nis;
      const nama = anak.nama_siswa;

      // ✅ Ganti siswa.nis → nis
      const [krsResult] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);
      const krs_id = krsResult[0][0]?.krs_id;

      if (!krs_id) {
        hasil.push({
          nis,
          nama,
          absensi: {
            hadir: 0,
            izin: 0,
            sakit: 0,
            alpha: 0
          },
          keterangan: 'KRS tidak ditemukan'
        });
        continue;
      }

      const [rekapResult] = await db.query('CALL sp_rekap_absen_siswa(?)', [krs_id]);
      const rekap = rekapResult[0]?.[0];

      hasil.push({
        nis,
        nama,
        absensi: {
          hadir: rekap?.hadir || 0,
          izin: rekap?.izin || 0,
          sakit: rekap?.sakit || 0,
          alpha: rekap?.alpha || 0
        }
      });
    }

    res.status(200).json({
      message: 'Rekap absensi semua anak berhasil diambil',
      data: hasil
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil rekap absensi anak', error: err.message });
  }
};

const getRiwayatAbsensiAnak = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil NIK ortu
    const [[ortu]] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (!ortu) return res.status(404).json({ message: 'Data orang tua tidak ditemukan' });

    // 2. Ambil semua anak dari ortu
    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const hasil = [];

    for (const anak of anakList[0]) {
      const nis = anak.nis;
      const nama = anak.nama_siswa;

      // 3. Ambil KRS aktif anak
      const [krsRows] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);
      const krs_id = krsRows[0][0]?.krs_id;
      if (!krs_id) continue;

      // 4. Ambil semua absensi tidak hadir
      const [absensiList] = await db.query(`
        SELECT 
          a.absensi_id,
          a.tanggal,
          a.keterangan,       -- 'i', 's', 'a'
          a.uraian,           -- deskripsi tambahan
          a.surat             -- file surat (jika ada)
        FROM absensi a
        WHERE a.krs_id = ?
          AND a.keterangan IN ('i', 's', 'a')
        ORDER BY a.tanggal DESC
      `, [krs_id]);

      const riwayat = absensiList.map(absen => ({
        tanggal: absen.tanggal,
        jenis: absen.keterangan === 'i' ? 'Izin' : absen.keterangan === 's' ? 'Sakit' : 'Alpha',
        uraian: absen.uraian,
        surat_url: absen.surat ? `${process.env.BASE_URL}/upload/surat/${absen.surat}` : null
      }));

      hasil.push({
        nis,
        nama,
        riwayat
      });
    }

    res.status(200).json({
      message: 'Riwayat absensi berhasil diambil',
      data: hasil
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil riwayat absensi', error: err.message });
  }
};


const postSuratIzin = async (req, res) => {
  const userId = req.user.userId;
  const { nis, tanggal, keterangan, uraian } = req.body;
  const fileSurat = req.file ? req.file.filename : null;

  try {
    // 1. Cari NIK ortu berdasarkan user login
    const [[ortu]] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (!ortu) return res.status(404).json({ message: 'Data ortu tidak ditemukan' });

    // 2. Cek apakah nis anak valid dan milik ortu ini
    const [anakList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [ortu.nik]);
    const anak = anakList[0].find(a => a.nis === nis);
    if (!anak) return res.status(403).json({ message: 'Anak tidak ditemukan atau tidak terkait ortu ini' });

    // 3. Ambil krs_id dari nis
    const [krsRows] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);
    const krs_id = krsRows[0]?.[0]?.krs_id;
    if (!krs_id) return res.status(404).json({ message: 'KRS tidak ditemukan' });

    // 4. Buat UUID untuk absensi_id
    const absensi_id = uuidv4();

    // 5. Insert melalui prosedur
    await db.query('CALL ortu_create_surat(?, ?, ?, ?, ?, ?)', [
      absensi_id,
      krs_id,
      tanggal,
      keterangan,
      uraian,
      fileSurat
    ]);

    return res.status(200).json({ message: 'Surat izin berhasil diajukan' });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Gagal mengajukan surat izin',
      error: err.message
    });
  }
};

const getTugasSiswa = async (req, res) => {
  const userId = req.user.userId;

  try {
    // 1. Ambil NIK ortu dari user
    const [[ortu]] = await db.query('SELECT nik FROM ortu WHERE user_id = ?', [userId]);
    if (!ortu) {
      return res.status(404).json({ message: 'Data ortu tidak ditemukan' });
    }

    const nik = ortu.nik;

    // 2. Ambil semua anak berdasarkan nik ortu
    const [siswaList] = await db.query('CALL sp_read_siswa_ortu_by_nik(?)', [nik]);
    if (siswaList[0].length === 0) {
      return res.status(404).json({ message: 'Tidak ada anak yang terhubung' });
    }

    // 3. Ambil tugas masing-masing anak
    const hasil = [];

    for (const siswa of siswaList[0]) {
      const nis = siswa.nis;
      const nama = siswa.nama_siswa;

      const [tugasRows] = await db.query('CALL sp_get_siswa_current_krs(?)', [nis]);

      hasil.push({
        nis,
        nama,
        tugas: tugasRows[0] || []
      });
    }

    return res.status(200).json({
      message: 'Tugas semua anak berhasil diambil',
      data: hasil
    });

  } catch (err) {
    console.error('❌ ERROR getSemuaTugasSiswaByOrtu:', err);
    return res.status(500).json({ message: 'Gagal mengambil tugas siswa', error: err.message });
  }
};




module.exports = {getBiodataOrtu, getSiswaByOrtu, getBerita, editBiodataOrtu, getStatistikNilai, getRekapAbsensi, postSuratIzin, getTugasSiswa, getRiwayatAbsensiAnak};

