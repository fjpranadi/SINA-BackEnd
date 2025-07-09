const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const nodemailer = require('nodemailer');
const transporter = require('../config/emailConfig');
const PDFDocument = require('pdfkit');
const { generateRaporPdf } = require('../middleware/generatePdf');

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

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// CREATE - Tambah Siswa + Ortu + User
const tambahSiswa = async (req, res) => {
    // 1. Destructuring data dari request body
    const {
        email, nama_siswa, nis, nisn, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin,
        agama, no_telepon, kelas_id,
        ayah_nik, ayah_nama, ayah_email, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan,
        ibu_nik, ibu_nama, ibu_email, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan,
        wali_nik, wali_nama, wali_email, wali_no_telepon, wali_tanggal_lahir, wali_tempat_lahir, wali_alamat, wali_pekerjaan
    } = req.body;

    const conn = await db.getConnection(); // Buka koneksi untuk validasi & transaksi

    try {
        // ==================================================================
        // BLOK VALIDASI INTERNAL
        // ==================================================================
        const errors = [];
        const isNumeric = (val) => val && /^\d+$/.test(val);
        const isEmail = (val) => val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        const isIndonesianPhone = (val) => val && /^08[0-9]{8,11}$/.test(val);

        // Validasi keberadaan data wajib
        const requiredFields = {
            nis, nisn, email, nama_siswa, no_telepon, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin, agama, kelas_id,
            ayah_nik, ayah_nama, ayah_email, ayah_no_telepon,
            ibu_nik, ibu_nama, ibu_email, ibu_no_telepon
        };
        for (const [field, value] of Object.entries(requiredFields)) {
            if (!value) {
                errors.push(`Field '${field}' tidak boleh kosong.`);
            }
        }
        
        // Jika ada error data wajib, langsung hentikan
        if (errors.length > 0) {
            // Tutup koneksi sebelum mengirim respons
            conn.release();
            return res.status(400).json({ error: 'Data tidak lengkap', detail: errors[0], errors });
        }

        // Validasi format dan panjang karakter
        if (!isNumeric(nisn) || nisn.length !== 10) errors.push('NISN harus berupa 10 digit angka.');
        if (!isNumeric(ayah_nik) || ayah_nik.length !== 16) errors.push('NIK Ayah harus berupa 16 digit angka.');
        if (!isNumeric(ibu_nik) || ibu_nik.length !== 16) errors.push('NIK Ibu harus berupa 16 digit angka.');
        if (wali_nik && (!isNumeric(wali_nik) || wali_nik.length !== 16)) errors.push('NIK Wali (jika diisi) harus berupa 16 digit angka.');
        if (!isEmail(email)) errors.push('Format email siswa tidak valid.');
        if (!isEmail(ayah_email)) errors.push('Format email ayah tidak valid.');
        if (!isEmail(ibu_email)) errors.push('Format email ibu tidak valid.');
        if (wali_email && !isEmail(wali_email)) errors.push('Format email wali tidak valid.');
        if (!isIndonesianPhone(no_telepon)) errors.push('Format nomor telepon siswa tidak valid (contoh: 081234567890).');
        if (!isIndonesianPhone(ayah_no_telepon)) errors.push('Format nomor telepon ayah tidak valid.');
        if (!isIndonesianPhone(ibu_no_telepon)) errors.push('Format nomor telepon ibu tidak valid.');
        
        // Cek keunikan data di database
        const [[siswaExists], [emailExists]] = await Promise.all([
             conn.query('SELECT nis FROM siswa WHERE nis = ?', [nis]),
             conn.query('SELECT email FROM user WHERE email = ?', [email])
        ]);
        if (siswaExists) errors.push(`Siswa dengan NIS ${nis} sudah terdaftar.`);
        if (emailExists) errors.push(`Email ${email} sudah digunakan oleh akun lain.`);

        // Jika ditemukan error, hentikan eksekusi
        if (errors.length > 0) {
            conn.release();
            return res.status(400).json({ error: 'Validasi Gagal', detail: errors[0], errors });
        }
        // ==================================================================
        // AKHIR BLOK VALIDASI
        // ==================================================================

        // 2. Mengelola file upload (jika lolos validasi)
        const fotoProfil = req.file;
        const filename = fotoProfil ? hashFileName(fotoProfil.originalname) : null;
        if (fotoProfil) {
            fs.renameSync(fotoProfil.path, path.join(fotoProfil.destination, filename));
        }

        // 3. Menyiapkan data umum
        const userPassword = bcrypt.hashSync('siswa123', 10);
        const ortuPassword = bcrypt.hashSync('ortu123', 10);
        const usernameFromEmail = email.split('@')[0];

        // 4. Memulai transaksi database SETELAH validasi berhasil
        await conn.beginTransaction();

        // 5. Proses pembuatan user dan data
        // Buat user untuk siswa
        const siswaUserId = await generateUniqueUserId(conn);
        await conn.query('CALL sp_create_user(?, ?, ?, ?, ?)', [siswaUserId, usernameFromEmail, email, userPassword, 'siswa']);
        
        // Buat data siswa
        await conn.query('CALL admin_create_siswa(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nis, siswaUserId, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin, agama, no_telepon, filename]);

        // Helper untuk memproses data orang tua/wali
        const prosesOrtu = async (nik, nama, emailOrtu, no_telp, tgl_lahir_ortu, tmp_lahir_ortu, alamat_ortu, pekerjaan_ortu, status) => {
            if (!nik || !nama || !emailOrtu) return null;
            
            let ortuUserId;
            const [existingOrtu] = await conn.query('SELECT user_id FROM ortu WHERE nik = ?', [nik]);

            if (existingOrtu) {
                ortuUserId = existingOrtu.user_id;
            } else {
                ortuUserId = await generateUniqueUserId(conn);
                await conn.query('CALL sp_create_user(?, ?, ?, ?, ?)', [ortuUserId, no_telp, emailOrtu, ortuPassword, 'ortu']);
                await conn.query('CALL admin_create_ortu(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [nik, ortuUserId, nama, null, alamat_ortu, status, pekerjaan_ortu, tmp_lahir_ortu, tgl_lahir_ortu, no_telp, null]);
            }
            
            await conn.query('CALL admin_create_siswa_ortu(?, ?)', [nis, nik]);
            return ortuUserId;
        };
        
        // Proses data Ayah, Ibu, dan Wali
        const ayahUserId = await prosesOrtu(ayah_nik, ayah_nama, ayah_email, ayah_no_telepon, ayah_tanggal_lahir, ayah_tempat_lahir, ayah_alamat, ayah_pekerjaan, 'ayah');
        const ibuUserId = await prosesOrtu(ibu_nik, ibu_nama, ibu_email, ibu_no_telepon, ibu_tanggal_lahir, ibu_tempat_lahir, ibu_alamat, ibu_pekerjaan, 'ibu');
        const waliUserId = await prosesOrtu(wali_nik, wali_nama, wali_email, wali_no_telepon, wali_tanggal_lahir, wali_tempat_lahir, wali_alamat, wali_pekerjaan, 'wali');

        // Pembuatan KRS
        const [lastKrs] = await conn.query(`SELECT krs_id FROM krs ORDER BY krs_id DESC LIMIT 1`);
        let newKrsId = 'KRS0001';
        if (lastKrs) {
            const lastNumber = parseInt(lastKrs.krs_id.replace('KRS', '')) + 1;
            newKrsId = `KRS${lastNumber.toString().padStart(4, '0')}`;
        }
        await conn.query('CALL admin_create_krs(?, ?, ?)', [newKrsId, nis, kelas_id]);
        await conn.query('CALL admin_create_krs_detail(?)', [kelas_id]);

        // 6. Commit transaksi jika semua berhasil
        await conn.commit();

        // 7. Kirim respons sukses
        res.status(201).json({
            message: 'Data siswa, orang tua, dan KRS berhasil ditambahkan',
            user_ids: {
                siswa: siswaUserId.toString(),
                ayah: ayahUserId?.toString() || null,
                ibu: ibuUserId?.toString() || null,
                wali: waliUserId?.toString() || null
            }
        });

    } catch (error) {
        // Rollback transaksi jika terjadi error SETELAH validasi
        await conn.rollback();
        console.error('Error saat tambah siswa:', error);
        res.status(500).json({
            error: 'Terjadi Kesalahan pada Server',
            detail: 'Gagal menambahkan data, transaksi telah dibatalkan. Silakan cek log server untuk detailnya.'
        });
    } finally {
        // Selalu lepaskan koneksi setelah selesai
        if (conn) conn.release();
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
    const { kelas_id } = req.params;

    if (!req.file) {
        return res.status(400).json({ message: "Mohon unggah sebuah file." });
    }

    const filePath = req.file.path;
    const conn = await db.getConnection();

    // MULAI TRANSAKSI UNTUK SELURUH FILE
    await conn.beginTransaction();

    try {
        const [kelasInfo] = await conn.query(
            `SELECT tingkat, kurikulum_id FROM kelas WHERE kelas_id = ?`,
            [kelas_id]
        );

        if (kelasInfo.length === 0) {
            throw new Error(`Operasi dibatalkan. Kelas dengan ID "${kelas_id}" tidak ditemukan.`);
        }
        const { tingkat, kurikulum_id } = kelasInfo[0];

        const [mapelUntukKelas] = await conn.query(
            `SELECT kd.mapel_id, m.nama_mapel, kd.kkm 
             FROM kurikulum_detail kd
             JOIN mapel m ON kd.mapel_id = m.mapel_id
             WHERE kd.tingkat = ? AND kd.kurikulum_id = ?`,
            [tingkat, kurikulum_id]
        );

        if (mapelUntukKelas.length === 0) {
            throw new Error(`Tidak ada mata pelajaran yang terdaftar di kurikulum untuk kelas ${kelas_id}. Proses impor dibatalkan.`);
        }

        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const dataFromExcel = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (!dataFromExcel || dataFromExcel.length === 0) {
            throw new Error("File Excel kosong atau tidak ada data yang bisa dibaca.");
        }

        const results = { successful: 0, failed: 0, errors: [] };
        const ortuPassword = bcrypt.hashSync('ortu123', 10);
        const userPassword = bcrypt.hashSync('siswa123', 10);
        
        // Buat Set untuk melacak NIS dan Email yang ada di dalam file Excel itu sendiri
        const nisInFile = new Set();
        const emailInFile = new Set();

        // Loop semua baris untuk validasi terlebih dahulu
        for (const [index, row] of dataFromExcel.entries()) {
            const rowNumber = index + 2;
            const nis = row['NIS']?.toString().trim();
            const email = row['Email Siswa']?.trim().toLowerCase();

            // Cek duplikasi di dalam file Excel
            if (nisInFile.has(nis)) {
                 throw new Error(`Validasi gagal: NIS duplikat '${nis}' ditemukan di dalam file Excel pada baris ${rowNumber}.`);
            }
            if (emailInFile.has(email)) {
                 throw new Error(`Validasi gagal: Email duplikat '${email}' ditemukan di dalam file Excel pada baris ${rowNumber}.`);
            }
            nisInFile.add(nis);
            emailInFile.add(email);

            // Cek duplikasi di database
            const [[siswaExists], [emailExists]] = await Promise.all([
                conn.query('SELECT nis FROM siswa WHERE nis = ?', [nis]),
                conn.query('SELECT email FROM user WHERE email = ?', [email])
            ]);
            if (siswaExists.length > 0) {
                 throw new Error(`Validasi gagal: NIS '${nis}' dari baris ${rowNumber} sudah ada di database.`);
            }
            if (emailExists.length > 0) {
                 throw new Error(`Validasi gagal: Email '${email}' dari baris ${rowNumber} sudah ada di database.`);
            }
        }
        
        // Jika semua validasi awal lolos, baru lakukan proses insert
        for (const [index, row] of dataFromExcel.entries()) {
            const rowNumber = index + 2;
            
            // Mapping dan pembersihan data
            const siswaData = {
                nis: row['NIS']?.toString().trim(),
                nisn: row['NISN']?.toString().trim(),
                nama_siswa: row['Nama Siswa']?.trim(),
                email: row['Email Siswa']?.trim().toLowerCase(),
                tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir']),
                tempat_lahir: row['Tempat Lahir']?.trim(),
                alamat: row['Alamat Siswa']?.trim(),
                jenis_kelamin: row['Jenis Kelamin']?.trim(),
                agama: row['Agama']?.trim(),
                no_telepon: formatPhoneNumber(row['No Telepon Siswa']),
                ayah_nik: row['NIK Ayah']?.toString().trim(),
                ayah_nama: row['Nama Ayah']?.trim(),
                ayah_email: row['Email Ayah']?.trim().toLowerCase(),
                ayah_no_telepon: formatPhoneNumber(row['No Telepon Ayah']),
                ayah_alamat: row['Alamat Ayah']?.trim(),
                ayah_pekerjaan: row['Pekerjaan Ayah']?.trim(),
                ayah_tempat_lahir: row['Tempat Lahir Ayah']?.trim(),     // <-- Tambahan
                ayah_tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir Ayah']), // <-- Tambahan
                ibu_nik: row['NIK Ibu']?.toString().trim(),
                ibu_nama: row['Nama Ibu']?.trim(),
                ibu_email: row['Email Ibu']?.trim().toLowerCase(),
                ibu_no_telepon: formatPhoneNumber(row['No Telepon Ibu']),
                ibu_alamat: row['Alamat Ibu']?.trim(),
                ibu_pekerjaan: row['Pekerjaan Ibu']?.trim(),
                ibu_tempat_lahir: row['Tempat Lahir Ibu']?.trim(),       // <-- Tambahan
                ibu_tanggal_lahir: formatDateForMySQL(row['Tanggal Lahir Ibu']),   // <-- Tambahan
            };
            
            // Proses data jika lolos validasi
            const usernameFromEmail = siswaData.email.split('@')[0];
            const siswaUserId = await generateUniqueUserId(conn);
            
            // Buat user & siswa
            await conn.query(`INSERT INTO user (user_id, username, email, password, role) VALUES (?, ?, ?, ?, 'siswa')`, [siswaUserId.toString(), usernameFromEmail, siswaData.email, userPassword]);
            await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat, jenis_kelamin, agama, no_telepon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [siswaData.nis, siswaUserId.toString(), siswaData.nisn, siswaData.nama_siswa, siswaData.tanggal_lahir, siswaData.tempat_lahir, siswaData.alamat, siswaData.jenis_kelamin, siswaData.agama, siswaData.no_telepon]);

            // Proses Ayah
            const ayahUserId = await generateUniqueUserId(conn);
            await conn.query(`INSERT INTO user (user_id, username, email, password, role) VALUES (?, ?, ?, ?, 'ortu')`, [ayahUserId.toString(), siswaData.ayah_no_telepon || siswaData.ayah_nik, siswaData.ayah_email, ortuPassword]);
            await conn.query(
                `INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu, pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [
                    siswaData.ayah_nik, 
                    ayahUserId.toString(), 
                    siswaData.ayah_nama, 
                    siswaData.ayah_alamat, 
                    'ayah', 
                    siswaData.ayah_pekerjaan,
                    siswaData.ayah_tempat_lahir,
                    siswaData.ayah_tanggal_lahir,
                    siswaData.ayah_no_telepon
                ]
            );
            await conn.query(`INSERT INTO siswa_ortu (nis, nik) VALUES (?, ?)`, [siswaData.nis, siswaData.ayah_nik]);
            
            // Proses Ibu
            const ibuUserId = await generateUniqueUserId(conn);
            await conn.query(`INSERT INTO user (user_id, username, email, password, role) VALUES (?, ?, ?, ?, 'ortu')`, [ibuUserId.toString(), siswaData.ibu_no_telepon || siswaData.ibu_nik, siswaData.ibu_email, ortuPassword]);
            await conn.query(
                `INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu, pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [
                    siswaData.ibu_nik, 
                    ibuUserId.toString(), 
                    siswaData.ibu_nama, 
                    siswaData.ibu_alamat,
                    'ibu',
                    siswaData.ibu_pekerjaan,
                    siswaData.ibu_tempat_lahir,
                    siswaData.ibu_tanggal_lahir,
                    siswaData.ibu_no_telepon
                ]
            );
            await conn.query(`INSERT INTO siswa_ortu (nis, nik) VALUES (?, ?)`, [siswaData.nis, siswaData.ibu_nik]);

            // Buat KRS
            const [lastKrs] = await conn.query(`SELECT krs_id FROM krs ORDER BY CAST(SUBSTRING(krs_id, 4) AS UNSIGNED) DESC LIMIT 1`);
            let newKrsId = 'KRS0001';
            if (lastKrs.length > 0 && lastKrs[0].krs_id) {
                const lastNumber = parseInt(lastKrs[0].krs_id.replace('KRS', '')) + 1;
                newKrsId = `KRS${lastNumber.toString().padStart(4, '0')}`;
            }
            await conn.query(`INSERT INTO krs (krs_id, siswa_nis, kelas_id) VALUES (?, ?, ?)`, [newKrsId, siswaData.nis, kelas_id]);
            for (const mapel of mapelUntukKelas) {
                // Masukkan setiap mata pelajaran ke krs_detail
                // guru_nip sengaja di-NULL kan sesuai logika SP
                await conn.query(
                    `INSERT INTO krs_detail (krs_id, mapel_id, nama_mapel, kkm, guru_nip) VALUES (?, ?, ?, ?, NULL)`,
                    [newKrsId, mapel.mapel_id, mapel.nama_mapel, mapel.kkm]
                );
            }
            results.successful++;
        }

        // Jika seluruh loop berhasil tanpa error, commit semuanya
        await conn.commit();
        res.status(200).json({ 
            message: `Proses impor selesai. Semua ${results.successful} data berhasil ditambahkan.`,
            ...results 
        });

    } catch (error) {
        // Jika ada error apapun yang terjadi (validasi atau DB), batalkan semuanya
        await conn.rollback();
        console.error('Error saat impor, transaksi dibatalkan:', error);
        res.status(500).json({ 
            message: "Gagal memproses file. Semua perubahan telah dibatalkan.", 
            error: error.message 
        });
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // Selalu hapus file setelah selesai
        }
        if (conn) conn.release();
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

const getRekapAbsenSiswa = async (req, res) => {
  const { kelas_id } = req.params;

  if (!kelas_id) {
      return res.status(400).json({ message: 'ID Kelas diperlukan.' });
  }

  try {
      // Memanggil stored procedure `sp_read_absen_siswa` dengan parameter
      const [rows] = await db.query(
          'CALL sp_read_absen_siswa(?)', 
          [kelas_id]
      );

      // Hasil dari stored procedure biasanya berada di indeks pertama dari array hasil
      res.status(200).json(rows[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Gagal mengambil data rekap absensi siswa.' });
  }
};

const sendStudentLoginInfo = async (studentData) => {
  const { email, nis, nisn, username, plainPassword } = studentData;
  
  if (!email) {
    console.log(`Siswa dengan NIS ${nis} tidak memiliki email, tidak mengirim email`);
    return;
  }

  try {
    const mailOptions = {
      from: `"SINA Sekolah" <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: 'Informasi Login Siswa',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h2 style="color: #333;">Informasi Akun Siswa</h2>
          <p>Berikut adalah informasi login untuk akun siswa Anda:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd; width: 30%;"><strong>NIS</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${nis}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>NISN</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${nisn}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Username</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Password</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${plainPassword}</td>
            </tr>
          </table>
          
          <p style="color: #ff0000; font-weight: bold;">Harap segera ganti password Anda setelah login pertama kali.</p>
          <p>Terima kasih,</p>
          <p>Admin Sekolah</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email login info terkirim ke siswa ${nis} (${email})`);
  } catch (error) {
    console.error(`Gagal mengirim email ke siswa ${nis}:`, error);
    throw error;
  }
};

/**
 * Send account activation info to parents
 */
const sendParentActivationInfo = async (studentData, parentData) => {
  const { nik, email, nama_ortu, status_ortu, no_telepon } = parentData;
  const { nis, nisn, nama_siswa } = studentData;

  if (!email) {
    console.log(`Ortu ${nama_ortu} (${status_ortu}) tidak memiliki email, tidak mengirim email`);
    return;
  }

  try {
    // Generate OTP (6 digits, valid for 7 days)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const conn = await db.getConnection();
    try {
      // Cek apakah sudah ada OTP untuk email ini
      const [existingOtp] = await conn.query(
        'SELECT id FROM otp_storage WHERE email = ?',
        [email]
      );

      if (existingOtp.length > 0) {
        // Update OTP yang sudah ada
        await conn.query(
          'UPDATE otp_storage SET otp = ?, expires_at = ?, created_at = NOW() WHERE email = ?',
          [otp, expiresAt, email]
        );
        console.log(`OTP diperbarui untuk ortu ${nama_ortu} (${email})`);
      } else {
        // Buat OTP baru
        await conn.query(
          'INSERT INTO otp_storage (email, otp, expires_at, created_at) VALUES (?, ?, ?, NOW())',
          [email, otp, expiresAt]
        );
        console.log(`OTP baru dibuat untuk ortu ${nama_ortu} (${email})`);
      }

      const mailOptions = {
        from: `"SINA Sekolah" <${process.env.EMAIL_FROM}>`,
        to: email,
        subject: `Aktivasi Akun Orang Tua - ${nama_siswa}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #333;">Informasi Akun Orang Tua</h2>
            <p>Berikut adalah informasi untuk aktivasi akun orang tua/wali:</p>
            
            <h3 style="margin-top: 20px;">Data Siswa</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; width: 30%;"><strong>Nama Siswa</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${nama_siswa}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>NIS</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${nis}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>NISN</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${nisn}</td>
              </tr>
            </table>
            
            <h3 style="margin-top: 20px;">Data Orang Tua/Wali</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd; width: 30%;"><strong>Nama</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${nama_ortu}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Status</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${status_ortu}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>No. Telepon</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${no_telepon}</td>
              </tr>
            </table>
            
            <h3 style="margin-top: 20px;">Aktivasi Akun</h3>
            <p>Gunakan kode OTP berikut untuk mengaktifkan akun Anda:</p>
            <div style="background: #f4f4f4; padding: 10px; border-radius: 5px; text-align: center; margin: 15px 0; font-size: 24px; font-weight: bold; letter-spacing: 3px;">
              ${otp}
            </div>
            <p style="color: #ff0000; font-weight: bold;">Kode OTP ini berlaku hingga ${expiresAt.toLocaleString()}.</p>
            <p>Setelah aktivasi, Anda akan diminta untuk membuat password untuk akun Anda.</p>
            <p>Terima kasih,</p>
            <p>Admin Sekolah</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email aktivasi terkirim ke ortu ${nama_ortu} (${status_ortu}) untuk siswa ${nis}`);
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error(`Gagal mengirim email aktivasi ke ortu ${nama_ortu} (${status_ortu}):`, error);
    throw error;
  }
};

const ensureStudentPassword = async (nis, conn) => {
  // 1. Cek apakah sudah ada token/password
  const [student] = await conn.query(
    `SELECT token FROM siswa WHERE nis = ?`, 
    [nis]
  );

  if (student.length === 0) {
    throw new Error(`Siswa dengan NIS ${nis} tidak ditemukan`);
  }

  let plainPassword = student[0].token;

  // 2. Jika token kosong/null, generate password baru
  if (!plainPassword) {
    plainPassword = generateRandomPassword();
    const hashedPassword = bcrypt.hashSync(plainPassword, 10);

    // Dapatkan user_id siswa
    const [userData] = await conn.query(
      `SELECT user_id FROM siswa WHERE nis = ?`,
      [nis]
    );
    const user_id = userData[0].user_id;

    // Update password di tabel user (hashed)
    await conn.query(
      `UPDATE user SET password = ? WHERE user_id = ?`,
      [hashedPassword, user_id]
    );

    // Update plain password di tabel siswa (kolom token)
    await conn.query(
      `UPDATE siswa SET token = ? WHERE nis = ?`,
      [plainPassword, nis]
    );
  }

  return plainPassword;
};

const sendStudentAndParentEmails = async (nis) => {
  const conn = await db.getConnection();
  try {
    // Pastikan siswa memiliki password
    const plainPassword = await ensureStudentPassword(nis, conn);

    // Get student data with email
    const [students] = await conn.query(`
      SELECT s.nis, s.nisn, s.nama_siswa, u.email, u.username
      FROM siswa s
      JOIN user u ON s.user_id = u.user_id
      WHERE s.nis = ?
    `, [nis]);

    if (students.length === 0) {
      throw new Error(`Siswa dengan NIS ${nis} tidak ditemukan`);
    }

    const student = {
      ...students[0],
      plainPassword // Tambahkan plainPassword ke data siswa
    };

    const results = {
      nis: student.nis,
      studentEmailSent: false,
      parents: []
    };

    // Send to student if has email
    if (student.email) {
      await sendStudentLoginInfo(student);
      results.studentEmailSent = true;
      results.studentPassword = student.plainPassword;
    }

    // Get all parents data
    const [parents] = await conn.query(`
      SELECT o.nik, o.nama_ortu, o.status_ortu, o.no_telepon, u.email
      FROM ortu o
      JOIN user u ON o.user_id = u.user_id
      JOIN siswa_ortu so ON o.nik = so.nik
      WHERE so.nis = ?
    `, [nis]);

    // Send to each parent
    for (const parent of parents) {
      try {
        await sendParentActivationInfo(student, parent);
        results.parents.push({
          nik: parent.nik,
          status: parent.status_ortu,
          email: parent.email,
          sent: true
        });
      } catch (error) {
        results.parents.push({
          nik: parent.nik,
          status: parent.status_ortu,
          email: parent.email,
          sent: false,
          error: error.message
        });
      }
    }

    return results;
  } finally {
    conn.release();
  }
};

const sendEmailToStudentByNis = async (req, res) => {
  const { nis } = req.params;

  try {
    const result = await sendStudentAndParentEmails(nis);
    res.json({
      message: `Proses pengiriman email untuk siswa ${nis} selesai`,
      result
    });
  } catch (error) {
    console.error(`Error sending email to student ${nis}:`, error);
    res.status(500).json({ 
      error: error.message,
      message: `Gagal mengirim email untuk siswa ${nis}`
    });
  }
};

/**
 * Send email to all students (and their parents)
 */
const sendEmailToAllStudents = async (req, res) => {
  try {
    const conn = await db.getConnection();
    const [allStudents] = await conn.query(`
      SELECT s.nis FROM siswa s
    `);
    conn.release();

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const student of allStudents) {
      try {
        const result = await sendStudentAndParentEmails(student.nis);
        results.push({
          nis: student.nis,
          status: 'success',
          detail: result
        });
        successCount++;
      } catch (error) {
        results.push({
          nis: student.nis,
          status: 'failed',
          error: error.message
        });
        failCount++;
      }
    }

    res.json({
      message: `Proses pengiriman email ke semua siswa selesai. Berhasil: ${successCount}, Gagal: ${failCount}`,
      results
    });
  } catch (error) {
    console.error('Error sending emails to all students:', error);
    res.status(500).json({ 
      error: error.message,
      message: 'Gagal mengirim email ke semua siswa'
    });
  }
};

const getRaporSiswa = async (req, res) => {
  const { nis } = req.params;
  const baseUrl = 'http://sina.pnb.ac.id:3001/reports'; // Ganti dengan base URL Anda
  
  try {
    // 1. Validasi NIS
    if (!nis || isNaN(nis)) {
      return res.status(400).json({ error: 'NIS harus berupa angka' });
    }

    // 2. Cek apakah siswa ada
    const [siswaResults] = await db.query('SELECT * FROM siswa WHERE nis = ?', [nis]);
    if (siswaResults.length === 0) {
      return res.status(404).json({ error: 'Siswa tidak ditemukan' });
    }

    // 3. Cari tahun akademik aktif
    const [tahunAkademik] = await db.query(`
      SELECT tahun_akademik_id FROM tahun_akademik 
      WHERE status = 'aktif' 
      LIMIT 1
    `);
    
    if (tahunAkademik.length === 0) {
      return res.status(404).json({ error: 'Tahun akademik aktif tidak ditemukan' });
    }

    const tahun_akademik_id = tahunAkademik[0].tahun_akademik_id;

    // 4. Cari file rapor di direktori reports
    const reportsDir = path.join(__dirname, '../../express-siswa/public/reports');
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 5. Cari file yang sesuai pola
    const files = fs.readdirSync(reportsDir);
    const matchingFiles = files.filter(file => 
      file.startsWith(`rapor_${nis}_`) && file.endsWith('.pdf')
    );

    // 6. Hapus file lama jika ada
    matchingFiles.forEach(file => {
      try {
        fs.unlinkSync(path.join(reportsDir, file));
        console.log(`File lama dihapus: ${file}`);
      } catch (err) {
        console.error(`Gagal menghapus file lama ${file}:`, err);
      }
    });

    // 7. Generate rapor baru (menggunakan logika dari getDetailRaporSiswa)
    // 7.1 Ambil biodata siswa
    const siswa = siswaResults[0];
    
    // 7.2 Ambil detail kelas
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

    // 7.3 Ambil semua nilai
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

    // 7.4 Hitung statistik nilai
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

    // 7.5 Siapkan data untuk PDF
    const nilaiUntukPdf = nilaiList.map(nilai => ({
      nama_mapel: nilai.nama_mapel,
      pengetahuan: nilai.nilai_pengetahuan,
      keterampilan: nilai.nilai_keterampilan,
      kkm: nilai.kkm,
      status: nilai.status,
      guru_pengampu: nilai.guru_pengampu
    }));

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
      nilai: nilaiUntukPdf,
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

    // 8. Generate PDF baru
    const pdfResult = await generateRaporPdf(pdfData);
    const filename = path.basename(pdfResult.filePath);

    // 9. Kembalikan URL dalam format JSON
    res.json({
      success: true,
      nis: nis,
      rapor_url: `${baseUrl}/${filename}`,
      filename: filename,
      timestamp: new Date().toISOString(),
      data: pdfData // Optional: bisa dihilangkan jika tidak ingin menampilkan data mentah
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      detail: error.message 
    });
  }
};


module.exports = {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis,
  importSiswaFromExcel,
  getRekapAbsenSiswa,
  sendEmailToStudentByNis,
  sendEmailToAllStudents,
  getRaporSiswa
};
