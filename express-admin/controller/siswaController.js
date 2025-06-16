const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// Helper untuk deteksi kata berbahayaa
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// Helper untuk Format Tanggal
const formatDateForMySQL = (dateInput) => {
  // Prioritas 1: Jika input sudah berupa objek Date yang valid
  if (dateInput instanceof Date && !isNaN(dateInput)) {
    const year = dateInput.getFullYear();
    const month = (dateInput.getMonth() + 1).toString().padStart(2, '0');
    const day = dateInput.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Prioritas 2: Jika berupa String (dari CSV)
  if (typeof dateInput === 'string') {
    // Cek format DD/MM/YYYY
    const parts = dateInput.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      // Pastikan semua bagian adalah angka dan valid sebelum menyusun kembali
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year.length === 4) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    // Jika format string lain, coba parse dengan new Date()
    const parsedDate = new Date(dateInput);
    if (!isNaN(parsedDate)) {
      return formatDateForMySQL(parsedDate);
    }
  }

  // Prioritas 3: Jika berupa Angka (Excel Serial Date)
  if (typeof dateInput === 'number' && dateInput > 0) {
    const utc_days = dateInput - 25569;
    const date = new Date(utc_days * 86400 * 1000);
    return formatDateForMySQL(date);
  }

  // Jika semua gagal, kembalikan null
  return null;
};

// Helper untuk nomor hp excel
const formatPhoneNumber = (phone) => {
  if (!phone) {
    return null;
  }
  // 1. Bersihkan dari semua karakter selain angka
  const cleaned = String(phone).replace(/\D/g, '');

  // 2. Jika diawali '62' (kode negara), ganti dengan '0'
  if (cleaned.startsWith('62')) {
    return '0' + cleaned.substring(2);
  }

  // 3. Jika tidak diawali '0' (misal: '812...'), tambahkan '0' di depan
  if (!cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  
  // 4. Jika sudah benar (diawali '0'), kembalikan apa adanya
  return cleaned;
};


// Helper hash nama file agar unik
const hashFileName = (originalname) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1e6);
  const ext = path.extname(originalname);
  return `${timestamp}_${random}${ext}`;
};

// CREATE - Tambah Siswa + Ortu + User
// Helper function untuk generate random BIGINT user_id
const generateUniqueUserId = async (conn) => {
  let isUnique = false;
  let newId;
  
  while (!isUnique) {
    // Generate 15-digit random number (BIGINT compatible)
    newId = BigInt(Math.floor(1e14 + Math.random() * 9e14)); // 100000000000000 - 999999999999999
    
    // Cek apakah ID sudah ada di database
    const [existing] = await conn.query(
      'SELECT user_id FROM user WHERE user_id = ?', 
      [newId.toString()]
    );
    
    if (existing.length === 0) {
      isUnique = true;
    }
  }
  
  return newId;
};

// CREATE - Tambah Siswa + Ortu + User
const tambahSiswa = async (req, res) => {
  const {
    email, nama_siswa, nis, nisn, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin,
    agama, no_telepon, kelas_id,
    ayah_nik, ayah_nama, ayah_email, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan,
    ibu_nik, ibu_nama, ibu_email, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan,
    wali_nik, wali_nama, wali_email, wali_no_telepon, wali_tanggal_lahir, wali_tempat_lahir, wali_alamat, wali_pekerjaan
  } = req.body;

  const fotoProfil = req.file;
  const userPassword = bcrypt.hashSync('siswa123', 10);
  const ortuPassword = bcrypt.hashSync('ortu123', 10);

  const usernameFromEmail = email.split('@')[0];
  const filename = fotoProfil ? hashFileName(fotoProfil.originalname) : null;
  
  if (fotoProfil) {
    fs.renameSync(fotoProfil.path, path.join(fotoProfil.destination, filename));
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Validasi kelas_id
    const [cekKelas] = await conn.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);
    if (cekKelas.length === 0) {
      throw new Error(`Kelas dengan ID ${kelas_id} tidak ditemukan.`);
    }

    // 1. Insert user siswa dengan user_id unik
    const siswaUserId = await generateUniqueUserId(conn);
    await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
      VALUES (?, ?, ?, ?, 'siswa', NOW())`, 
      [siswaUserId.toString(), usernameFromEmail, email, userPassword]);

    // 2. Insert siswa
    await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir,
      alamat, jenis_kelamin, agama, no_telepon, foto_profil, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nis, siswaUserId.toString(), nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat,
        jenis_kelamin, agama, no_telepon, filename]);

    // 3. Insert data KRS
    const [lastKrs] = await conn.query(`SELECT krs_id FROM krs ORDER BY krs_id DESC LIMIT 1`);
    let newKrsId = 'KRS0001';
    if (lastKrs.length > 0) {
      const lastNumber = parseInt(lastKrs[0].krs_id.replace('KRS', '')) + 1;
      newKrsId = `KRS${lastNumber.toString().padStart(4, '0')}`;
    }

    await conn.query(`INSERT INTO krs (krs_id, siswa_nis, kelas_id, status_pembayaran, created_at)
      VALUES (?, ?, ?, 0, NOW())`, [newKrsId, nis, kelas_id]);

    // === AYAH ===
    const ayahUserId = await generateUniqueUserId(conn);
    await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
      VALUES (?, ?, ?, ?, 'ortu', NOW())`, 
      [ayahUserId.toString(), ayah_no_telepon, ayah_email, ortuPassword]);

    await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
      pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
      VALUES (?, ?, ?, ?, 'ayah', ?, ?, ?, ?, NOW())`, [
        ayah_nik, ayahUserId.toString(), ayah_nama, ayah_alamat,
        ayah_pekerjaan, ayah_tempat_lahir, ayah_tanggal_lahir, ayah_no_telepon
    ]);

    await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ayah_nik]);

    // === IBU ===
    const ibuUserId = await generateUniqueUserId(conn);
    await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
      VALUES (?, ?, ?, ?, 'ortu', NOW())`, 
      [ibuUserId.toString(), ibu_no_telepon, ibu_email, ortuPassword]);

    await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
      pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
      VALUES (?, ?, ?, ?, 'ibu', ?, ?, ?, ?, NOW())`, [
        ibu_nik, ibuUserId.toString(), ibu_nama, ibu_alamat,
        ibu_pekerjaan, ibu_tempat_lahir, ibu_tanggal_lahir, ibu_no_telepon
    ]);

    await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ibu_nik]);

    // === WALI (jika ada) ===
let waliUserId = null; // Deklarasikan di luar blok if

if (wali_nik && wali_nama && wali_email) {
  waliUserId = await generateUniqueUserId(conn);
  await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at)
    VALUES (?, ?, ?, ?, 'ortu', NOW())`, 
    [waliUserId.toString(), wali_no_telepon, wali_email, ortuPassword]);

  await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
    pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
    VALUES (?, ?, ?, ?, 'wali', ?, ?, ?, ?, NOW())`, [
      wali_nik, waliUserId.toString(), wali_nama, wali_alamat,
      wali_pekerjaan, wali_tempat_lahir, wali_tanggal_lahir, wali_no_telepon
  ]);

  await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, wali_nik]);
}

    await conn.commit();
    
    // Prepare response data
    const responseData = { 
      message: 'Data siswa, ayah, ibu (dan wali jika ada) berhasil ditambahkan.',
      user_ids: {
        siswa: siswaUserId.toString(),
        ayah: ayahUserId.toString(),
        ibu: ibuUserId.toString()
      }
    };

    // Add wali data if exists
    if (waliUserId) {
      responseData.user_ids.wali = waliUserId.toString();
    }

    res.status(201).json(responseData);
  } catch (error) {
    await conn.rollback();
    console.error('Error tambah siswa:', error);
    res.status(500).json({ 
      error: error.message,
      detail: 'Gagal menambahkan data siswa dan orang tua' 
    });
  } finally {
    conn.release();
  }
};

// READ - Get semua siswa
const getAllSiswa = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM siswa`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE - Update data siswa
// UPDATE - Update data siswa beserta ortu (ayah, ibu)
const updateSiswa = async (req, res) => {
  const { nis } = req.params;
  const {
    email, nis: newNis, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin,
    agama, no_telepon,
    ayah_nik, ayah_nama, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan,
    ibu_nik, ibu_nama, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan
  } = req.body;
  const fotoProfil = req.file;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Ambil data lama
    const [[oldSiswa]] = await conn.query(`SELECT * FROM siswa WHERE nis = ?`, [nis]);
    if (!oldSiswa) throw new Error('Data siswa tidak ditemukan.');

    const [[oldUser]] = await conn.query(`SELECT * FROM user WHERE user_id = ?`, [oldSiswa.user_id]);

    const [ortuList] = await conn.query(`SELECT * FROM siswa_ortu JOIN ortu USING(nik) WHERE nis = ?`, [nis]);

    const ayah = ortuList.find(o => o.status_ortu === 'ayah');
    const ibu = ortuList.find(o => o.status_ortu === 'ibu');

    // Update user (siswa)
    const usernameFromEmail = email ? email.split('@')[0] : oldUser.username;
    await conn.query(`UPDATE user SET username = ?, email = ? WHERE user_id = ?`, [
      usernameFromEmail,
      email || oldUser.email,
      oldUser.user_id
    ]);

    // Update siswa
    let newFoto = oldSiswa.foto_profil;
    if (fotoProfil) {
      const filename = hashFileName(fotoProfil.originalname);
      fs.renameSync(fotoProfil.path, path.join(fotoProfil.destination, filename));
      newFoto = filename;
    }
	
if (newNis && newNis !== nis) {
  await conn.query(`UPDATE krs SET siswa_nis = ? WHERE siswa_nis = ?`, [newNis, nis]);
  await conn.query(`UPDATE siswa_ortu SET nis = ? WHERE nis = ?`, [newNis, nis]);
}


    await conn.query(`UPDATE siswa SET
      nis = ?, nisn = ?, nama_siswa = ?, tanggal_lahir = ?, tempat_lahir = ?,
      alamat = ?, jenis_kelamin = ?, agama = ?, no_telepon = ?, foto_profil = ?
      WHERE nis = ?`, [
      newNis || nis,
      nisn || oldSiswa.nisn,
      nama_siswa || oldSiswa.nama_siswa,
      tanggal_lahir || oldSiswa.tanggal_lahir,
      tempat_lahir || oldSiswa.tempat_lahir,
      alamat || oldSiswa.alamat,
      jenis_kelamin || oldSiswa.jenis_kelamin,
      agama || oldSiswa.agama,
      no_telepon || oldSiswa.no_telepon,
      newFoto,
      nis
    ]);

    // === AYAH ===
    if (ayah) {
      await conn.query(`UPDATE ortu SET
        nama_ortu = ?, alamat = ?, pekerjaan = ?, tempat_lahir_ortu = ?,
        tanggal_lahir_ortu = ?, no_telepon = ?
        WHERE nik = ?`, [
        ayah_nama || ayah.nama_ortu,
        ayah_alamat || ayah.alamat,
        ayah_pekerjaan || ayah.pekerjaan,
        ayah_tempat_lahir || ayah.tempat_lahir_ortu,
        ayah_tanggal_lahir || ayah.tanggal_lahir_ortu,
        ayah_no_telepon || ayah.no_telepon,
        ayah_nik || ayah.nik
      ]);
    }

    // === IBU ===
    if (ibu) {
      await conn.query(`UPDATE ortu SET
        nama_ortu = ?, alamat = ?, pekerjaan = ?, tempat_lahir_ortu = ?,
        tanggal_lahir_ortu = ?, no_telepon = ?
        WHERE nik = ?`, [
        ibu_nama || ibu.nama_ortu,
        ibu_alamat || ibu.alamat,
        ibu_pekerjaan || ibu.pekerjaan,
        ibu_tempat_lahir || ibu.tempat_lahir_ortu,
        ibu_tanggal_lahir || ibu.tanggal_lahir_ortu,
        ibu_no_telepon || ibu.no_telepon,
        ibu_nik || ibu.nik
      ]);
    }

    await conn.commit();
    res.json({ message: 'Data siswa berhasil diperbarui.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
  } finally {
    conn.release();
  }
};

// DELETE - Hapus siswa
// DELETE - Hapus siswa dan semua data terkait
const deleteSiswa = async (req, res) => {
  const { nis } = req.params;
  const conn = await db.getConnection();
  
  try {
    await conn.beginTransaction();

    // 1. Dapatkan user_id dari siswa yang akan dihapus
    const [siswaData] = await conn.query(
      `SELECT user_id FROM siswa WHERE nis = ?`, 
      [nis]
    );
    
    if (siswaData.length === 0) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }
    
    const user_id = siswaData[0].user_id;

    // 2. Dapatkan semua nik ortu yang terkait dengan siswa ini
    const [ortuData] = await conn.query(
      `SELECT nik FROM siswa_ortu WHERE nis = ?`,
      [nis]
    );
    const nikOrtuList = ortuData.map(ortu => ortu.nik);

    // 3. Hapus data KRS siswa
    await conn.query(
      `DELETE FROM krs WHERE siswa_nis = ?`,
      [nis]
    );

    // 4. Hapus relasi siswa_ortu
    await conn.query(
      `DELETE FROM siswa_ortu WHERE nis = ?`,
      [nis]
    );

    // 5. Hapus data ortu dan user ortu
    for (const nik of nikOrtuList) {
      // Dapatkan user_id ortu
      const [ortu] = await conn.query(
        `SELECT user_id FROM ortu WHERE nik = ?`,
        [nik]
      );
      
      if (ortu.length > 0) {
        const ortu_user_id = ortu[0].user_id;
        
        // Hapus ortu
        await conn.query(
          `DELETE FROM ortu WHERE nik = ?`,
          [nik]
        );
        
        // Hapus user ortu
        await conn.query(
          `DELETE FROM user WHERE user_id = ?`,
          [ortu_user_id]
        );
      }
    }

    // 6. Hapus siswa
    await conn.query(
      `DELETE FROM siswa WHERE nis = ?`,
      [nis]
    );

    // 7. Hapus user siswa
    await conn.query(
      `DELETE FROM user WHERE user_id = ?`,
      [user_id]
    );

    await conn.commit();
    res.json({ 
      message: 'Siswa dan semua data terkait berhasil dihapus',
      deleted: {
        siswa: nis,
        user: user_id,
        ortu: nikOrtuList,
        krs: true
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error deleting siswa:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Gagal menghapus data siswa' 
    });
  } finally {
    conn.release();
  }
};

// GET - Siswa by NIS
const getSiswaBynis = async (req, res) => {
  const { nis } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        u.email, s.nis, s.nisn, s.nama_siswa, s.tanggal_lahir, s.tempat_lahir,
        s.alamat, s.jenis_kelamin, s.agama, s.no_telepon, s.foto_profil, s.created_at,
        
        -- Ayah
        ayah.nik AS ayah_nik,
        ayah.nama_ortu AS ayah_nama,
        ayah.no_telepon AS ayah_no_telepon,
        ayah.tanggal_lahir_ortu AS ayah_tanggal_lahir,
        ayah.tempat_lahir_ortu AS ayah_tempat_lahir,
        ayah.alamat AS ayah_alamat,
        ayah.pekerjaan AS ayah_pekerjaan,

        -- Ibu
        ibu.nik AS ibu_nik,
        ibu.nama_ortu AS ibu_nama,
        ibu.no_telepon AS ibu_no_telepon,
        ibu.tanggal_lahir_ortu AS ibu_tanggal_lahir,
        ibu.tempat_lahir_ortu AS ibu_tempat_lahir,
        ibu.alamat AS ibu_alamat,
        ibu.pekerjaan AS ibu_pekerjaan

      FROM siswa s
      LEFT JOIN user u ON u.user_id = s.user_id
      LEFT JOIN siswa_ortu sa ON s.nis = sa.nis
      LEFT JOIN ortu ayah ON ayah.nik = sa.nik AND ayah.status_ortu = 'ayah'
      LEFT JOIN ortu ibu ON ibu.nik = sa.nik AND ibu.status_ortu = 'ibu'
      WHERE s.nis = ?
    `, [nis]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
    }

    // hasil bisa banyak baris karena join ke ortu ganda (ayah/ibu) → gabung manual
    const siswa = {
      email: rows[0].email,
      nis: rows[0].nis,
      nisn: rows[0].nisn,
      nama_siswa: rows[0].nama_siswa,
      tanggal_lahir: rows[0].tanggal_lahir,
      tempat_lahir: rows[0].tempat_lahir,
      alamat: rows[0].alamat,
      jenis_kelamin: rows[0].jenis_kelamin,
      agama: rows[0].agama,
      no_telepon: rows[0].no_telepon,
      foto_profil: rows[0].foto_profil,
      created_at: rows[0].created_at,
    };

    for (const row of rows) {
      if (row.ayah_nik && !siswa.ayah_nik) {
        siswa.ayah_nik = row.ayah_nik;
        siswa.ayah_nama = row.ayah_nama;
        siswa.ayah_no_telepon = row.ayah_no_telepon;
        siswa.ayah_tanggal_lahir = row.ayah_tanggal_lahir;
        siswa.ayah_tempat_lahir = row.ayah_tempat_lahir;
        siswa.ayah_alamat = row.ayah_alamat;
        siswa.ayah_pekerjaan = row.ayah_pekerjaan;
      }
      if (row.ibu_nik && !siswa.ibu_nik) {
        siswa.ibu_nik = row.ibu_nik;
        siswa.ibu_nama = row.ibu_nama;
        siswa.ibu_no_telepon = row.ibu_no_telepon;
        siswa.ibu_tanggal_lahir = row.ibu_tanggal_lahir;
        siswa.ibu_tempat_lahir = row.ibu_tempat_lahir;
        siswa.ibu_alamat = row.ibu_alamat;
        siswa.ibu_pekerjaan = row.ibu_pekerjaan;
      }
    }

    res.json(siswa); 
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const importSiswaFromExcel = async (req, res) => {
  // 1. Ambil kelas_id dari parameter URL
  const { kelas_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ message: "Mohon unggah sebuah file." });
  }

  const filePath = req.file.path;
  const conn = await db.getConnection();

  try {
    // 2. Validasi kelas_id dari URL sebelum memproses file
    // Pastikan kelas tujuan impor benar-benar ada di database.
    const [kelasExists] = await conn.query('SELECT kelas_id FROM kelas WHERE kelas_id = ?', [kelas_id]);
    if (kelasExists.length === 0) {
      // Jika kelas tidak ada, hapus file yang sudah diupload dan kirim error.
      fs.unlinkSync(filePath);
      conn.release();
      return res.status(404).json({ message: `Operasi dibatalkan. Kelas dengan ID "${kelas_id}" tidak ditemukan.` });
    }

    let dataFromExcel;

    // Logika parsing file CSV atau XLSX (Tidak ada perubahan)
    if (req.file.originalname.toLowerCase().endsWith('.csv')) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        let cleanContent = fileContent.trim();
        if (cleanContent.charCodeAt(0) === 0xFEFF) { cleanContent = cleanContent.slice(1); }
        const rows = cleanContent.split(/\r?\n/);
        const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
        dataFromExcel = [];
        for (let i = 1; i < rows.length; i++) {
            if (!rows[i].trim()) continue;
            const values = rows[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const rowObject = {};
            headers.forEach((header, index) => { rowObject[header] = values[index]; });
            dataFromExcel.push(rowObject);
        }
    } else if (req.file.originalname.toLowerCase().endsWith('.xlsx')) {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        dataFromExcel = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    } else {
        throw new Error('Format file tidak didukung. Harap unggah file .CSV atau .XLSX');
    }

    if (!dataFromExcel || dataFromExcel.length === 0) {
        throw new Error("Tidak ada data yang bisa dibaca dari file.");
    }

    // Logika penomoran KRS (Tidak ada perubahan)
    const [maxKrs] = await conn.query("SELECT MAX(CAST(SUBSTRING(krs_id, 4) AS UNSIGNED)) as max_num FROM krs WHERE krs_id LIKE 'KRS%'");
    let nextKrsNumber = (maxKrs[0].max_num || 0) + 1;

    const results = { successful: 0, failed: 0, errors: [] };

    for (const row of dataFromExcel) {
      await conn.beginTransaction();
      try {
        const newKrsId = `KRS${nextKrsNumber.toString().padStart(4, '0')}`;
        
        // 3. Mapping data dari Excel. Perhatikan bahwa 'kelas_id' sekarang diambil dari URL.
        const siswaData = {
          nis: row['NIS'],
          nisn: row['NISN'],
          nama_siswa: row['Nama Siswa'],
          email: row['Email Siswa'],
          tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir']),
          tempat_lahir: row['Tempat Lahir'],
          alamat: row['Alamat Siswa'],
          jenis_kelamin: row['Jenis Kelamin'],
          agama: row['Agama'],
          no_telepon: formatPhoneNumber(row['No Telepon Siswa']),
          
          // --- INI BAGIAN PENTING ---
          // Gunakan kelas_id dari parameter URL untuk setiap siswa
          kelas_id: kelas_id, 
          
          krs_id: newKrsId,
          filename: null,
          ayah_nik: row['NIK Ayah'],
          ayah_nama: row['Nama Ayah'],
          ayah_email: row['Email Ayah'],
          ayah_tempat_lahir: row['Tempat Lahir Ayah'],
          ayah_tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir Ayah']),
          ayah_alamat: row['Alamat Ayah'],
          ayah_pekerjaan: row['Pekerjaan Ayah'],
          ayah_no_telepon: formatPhoneNumber(row['No Telepon Ayah']),
          ibu_nik: row['NIK Ibu'],
          ibu_nama: row['Nama Ibu'],
          ibu_email: row['Email Ibu'],
          ibu_tempat_lahir: row['Tempat Lahir Ibu'],
          ibu_tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir Ibu']),
          ibu_alamat: row['Alamat Ibu'],
          ibu_pekerjaan: row['Pekerjaan Ibu'],
          ibu_no_telepon: formatPhoneNumber(row['No Telepon Ibu']),
        };

        // Memanggil fungsi transaksi (Tidak ada perubahan)
        await _createSiswaWithParentsTransaction(siswaData, conn);
        
        await conn.commit();
        results.successful++;
        nextKrsNumber++;
      } catch (error) {
        await conn.rollback();
        results.failed++;
        results.errors.push({ nis: row['NIS'] || `BARIS_${results.successful + results.failed}`, reason: error.message });
      }
    }

    res.status(200).json({ message: `Proses impor ke kelas ${kelas_id} selesai.`, ...results });

  } catch (error) {
    await conn.rollback();
    console.error('Error saat impor:', error);
    res.status(500).json({ message: "Gagal memproses file.", error: error.message });
  } finally {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    conn.release();
  }
};

const _createSiswaWithParentsTransaction = async (data, conn) => {
  // Ambil semua data yang dibutuhkan dari objek 'data'
  const {
      email, nama_siswa, nis, nisn, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin,
      agama, no_telepon, kelas_id, filename, // filename didapat dari pemanggil
      ayah_nik, ayah_nama, ayah_email, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan,
      ibu_nik, ibu_nama, ibu_email, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan,
      wali_nik, wali_nama, wali_email, wali_no_telepon, wali_tanggal_lahir, wali_tempat_lahir, wali_alamat, wali_pekerjaan
  } = data;

  const userPassword = bcrypt.hashSync('siswa123', 10);
  const ortuPassword = bcrypt.hashSync('ortu123', 10);
  const usernameFromEmail = email.split('@')[0];

  // Validasi kelas_id
  const [cekKelas] = await conn.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);
  if (cekKelas.length === 0) {
      throw new Error(`Kelas dengan ID ${kelas_id} tidak ditemukan.`);
  }

  // 1. Insert user siswa
  const siswaUserId = await generateUniqueUserId(conn);
  await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, 'siswa', NOW())`,
      [siswaUserId.toString(), usernameFromEmail, email, userPassword]);

  // 2. Insert siswa
  await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin, agama, no_telepon, foto_profil, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nis, siswaUserId.toString(), nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin, agama, no_telepon, filename]);

  // 3. Insert data KRS
  const [lastKrs] = await conn.query(`
    SELECT krs_id FROM krs 
    WHERE krs_id LIKE 'KRS%'
    ORDER BY CAST(SUBSTRING(krs_id, 4) AS UNSIGNED) DESC
    LIMIT 1
  `);

  let newKrsNumber = 1; // Default jika tidak ada data
  
  if (lastKrs.length > 0) {
    // Ekstrak angka dari krs_id terakhir
    const lastKrsId = lastKrs[0].krs_id;
    const lastNumber = parseInt(lastKrsId.replace('KRS', ''), 10);
    
    if (!isNaN(lastNumber)) {
      newKrsNumber = lastNumber + 1;
    }
  }

  // Format dengan leading zeros (4 digit)
  const newKrsId = 'KRS' + newKrsNumber.toString().padStart(4, '0');

  await conn.query(
    `INSERT INTO krs (krs_id, siswa_nis, kelas_id, status_pembayaran, created_at) 
     VALUES (?, ?, ?, 0, NOW())`, 
    [newKrsId, nis, kelas_id]
  );
  // === AYAH ===
  const ayahUserId = await generateUniqueUserId(conn);
  await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, 'ortu', NOW())`,
      [ayahUserId.toString(), ayah_no_telepon, ayah_email, ortuPassword]);
  await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu, pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at) VALUES (?, ?, ?, ?, 'ayah', ?, ?, ?, ?, NOW())`,
      [ayah_nik, ayahUserId.toString(), ayah_nama, ayah_alamat, ayah_pekerjaan, ayah_tempat_lahir, ayah_tanggal_lahir, ayah_no_telepon]);
  await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ayah_nik]);

  // === IBU ===
  const ibuUserId = await generateUniqueUserId(conn);
  await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, 'ortu', NOW())`,
      [ibuUserId.toString(), ibu_no_telepon, ibu_email, ortuPassword]);
  await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu, pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at) VALUES (?, ?, ?, ?, 'ibu', ?, ?, ?, ?, NOW())`,
      [ibu_nik, ibuUserId.toString(), ibu_nama, ibu_alamat, ibu_pekerjaan, ibu_tempat_lahir, ibu_tanggal_lahir, ibu_no_telepon]);
  await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ibu_nik]);

  // === WALI (jika ada) ===
  let waliUserId = null;
  if (wali_nik && wali_nama && wali_email) {
      waliUserId = await generateUniqueUserId(conn);
      await conn.query(`INSERT INTO user (user_id, username, email, password, role, created_at) VALUES (?, ?, ?, ?, 'ortu', NOW())`,
          [waliUserId.toString(), wali_no_telepon, wali_email, ortuPassword]);
      await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu, pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at) VALUES (?, ?, ?, ?, 'wali', ?, ?, ?, ?, NOW())`,
          [wali_nik, waliUserId.toString(), wali_nama, wali_alamat, wali_pekerjaan, wali_tempat_lahir, wali_tanggal_lahir, wali_no_telepon]);
      await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, wali_nik]);
  }

  // Kembalikan ID yang dibuat untuk keperluan response
  const created_ids = {
      siswa: siswaUserId.toString(),
      ayah: ayahUserId.toString(),
      ibu: ibuUserId.toString(),
      wali: waliUserId ? waliUserId.toString() : null,
  };
  return created_ids;
};

module.exports = {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis,
  importSiswaFromExcel
};
