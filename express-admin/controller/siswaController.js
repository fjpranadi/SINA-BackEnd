const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');



// Helper untuk deteksi kata berbahayaa
const containsSQLInjection = (input) => {
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};


// Helper hash nama file agar unik
const hashFileName = (originalname) => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1e6);
  const ext = path.extname(originalname);
  return `${timestamp}_${random}${ext}`;
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

  const usernameFromEmail = email.split('@')[0]; // username dari email

  const filename = fotoProfil ? hashFileName(fotoProfil.originalname) : null;
  if (fotoProfil) {
    fs.renameSync(fotoProfil.path, path.join(fotoProfil.destination, filename));
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {

    // ✅ Validasi kelas_id
    const [cekKelas] = await conn.query(`SELECT * FROM kelas WHERE kelas_id = ?`, [kelas_id]);
    if (cekKelas.length === 0) {
      throw new Error(`Kelas dengan ID ${kelas_id} tidak ditemukan.`);
    }

    // 1. Insert user siswa
    const [userSiswa] = await conn.query(`INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'siswa', NOW())`, [usernameFromEmail, email, userPassword]);

    // 2. Insert siswa
    await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir,
      alamat, jenis_kelamin, agama, no_telepon, foto_profil, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nis, userSiswa.insertId, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat,
        jenis_kelamin, agama, no_telepon, filename]);

    // 3. Insert data KRS
    // ✅ Generate krs_id secara manual (misal format KRS0001)
    const [lastKrs] = await conn.query(`SELECT krs_id FROM krs ORDER BY krs_id DESC LIMIT 1`);
    let newKrsId = 'KRS0001';
    if (lastKrs.length > 0) {
      const lastNumber = parseInt(lastKrs[0].krs_id.replace('KRS', '')) + 1;
      newKrsId = `KRS${lastNumber.toString().padStart(4, '0')}`;
    }

     await conn.query(`INSERT INTO krs (krs_id, siswa_nis, kelas_id, status_pembayaran, created_at)
      VALUES (?, ?, ?, 0, NOW())`, [newKrsId, nis, kelas_id]);

    // === AYAH ===
    const [userAyah] = await conn.query(`INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'ortu', NOW())`, [
        ayah_no_telepon, ayah_email, ortuPassword
    ]);

    await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
      pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
      VALUES (?, ?, ?, ?, 'ayah', ?, ?, ?, ?, NOW())`, [
        ayah_nik, userAyah.insertId, ayah_nama, ayah_alamat,
        ayah_pekerjaan, ayah_tempat_lahir, ayah_tanggal_lahir, ayah_no_telepon
    ]);

    await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ayah_nik]);

    // === IBU ===
    const [userIbu] = await conn.query(`INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'ortu', NOW())`, [
        ibu_no_telepon, ibu_email, ortuPassword
    ]);

    await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
      pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
      VALUES (?, ?, ?, ?, 'ibu', ?, ?, ?, ?, NOW())`, [
        ibu_nik, userIbu.insertId, ibu_nama, ibu_alamat,
        ibu_pekerjaan, ibu_tempat_lahir, ibu_tanggal_lahir, ibu_no_telepon
    ]);

    await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, ibu_nik]);

    // === WALI (jika ada) ===
    if (wali_nik && wali_nama && wali_email) {
      const [userWali] = await conn.query(`INSERT INTO user (username, email, password, role, created_at)
        VALUES (?, ?, ?, 'ortu', NOW())`, [
          wali_no_telepon, wali_email, ortuPassword
      ]);

      await conn.query(`INSERT INTO ortu (nik, user_id, nama_ortu, alamat, status_ortu,
        pekerjaan, tempat_lahir_ortu, tanggal_lahir_ortu, no_telepon, created_at)
        VALUES (?, ?, ?, ?, 'wali', ?, ?, ?, ?, NOW())`, [
          wali_nik, userWali.insertId, wali_nama, wali_alamat,
          wali_pekerjaan, wali_tempat_lahir, wali_tanggal_lahir, wali_no_telepon
      ]);

      await conn.query(`INSERT INTO siswa_ortu (nis, nik, created_at) VALUES (?, ?, NOW())`, [nis, wali_nik]);
    }

    await conn.commit();
    res.status(201).json({ message: 'Data siswa, ayah, ibu (dan wali jika ada) berhasil ditambahkan.' });
  } catch (error) {
    await conn.rollback();
    console.error(error);
    res.status(500).json({ error: error.message });
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
const deleteSiswa = async (req, res) => {
  const { nis } = req.params;
  try {
    await db.query(`DELETE FROM siswa WHERE nis = ?`, [nis]);
    res.json({ message: 'Data siswa berhasil dihapus.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET - Siswa by NIS
const getSiswaBynis = async (req, res) => {
  const { nis } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        u.email, s.nis, s.nisn, s.nama_siswa, s.tanggal_lahir, s.tempat_lahir,
        s.alamat, s.jenis_kelamin, s.agama, s.no_telepon, s.foto_profil,
        
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




module.exports = {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis
};
