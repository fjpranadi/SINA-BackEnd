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
    agama, no_telepon,
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
    // 1. Insert user siswa
    const [userSiswa] = await conn.query(`INSERT INTO user (username, email, password, role, created_at)
      VALUES (?, ?, ?, 'siswa', NOW())`, [usernameFromEmail, email, userPassword]);

    // 2. Insert siswa
    await conn.query(`INSERT INTO siswa (nis, user_id, nisn, nama_siswa, tanggal_lahir, tempat_lahir,
      alamat, jenis_kelamin, agama, no_telepon, foto_profil, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [nis, userSiswa.insertId, nisn, nama_siswa, tanggal_lahir, tempat_lahir, alamat,
        jenis_kelamin, agama, no_telepon, filename]);

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
const updateSiswa = async (req, res) => {
  const { nis } = req.params;
  const data = req.body;

  try {
    const [existingData] = await db.query(`SELECT * FROM siswa WHERE nis = ?`, [nis]);
    if (existingData.length === 0) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    const siswa = existingData[0];
    const updateData = {
      nama_siswa: data.nama_siswa || siswa.nama_siswa,
      tanggal_lahir: data.tanggal_lahir || siswa.tanggal_lahir,
      tempat_lahir: data.tempat_lahir || siswa.tempat_lahir,
      alamat: data.alamat || siswa.alamat,
      jenis_kelamin: data.jenis_kelamin || siswa.jenis_kelamin,
      agama: data.agama || siswa.agama,
      no_telepon: data.no_telepon || siswa.no_telepon
    };

    await db.query(`
      UPDATE siswa SET 
        nama_siswa=?, tanggal_lahir=?, tempat_lahir=?, alamat=?,
        jenis_kelamin=?, agama=?, no_telepon=?
      WHERE nis=?`,
      [updateData.nama_siswa, updateData.tanggal_lahir, updateData.tempat_lahir,
      updateData.alamat, updateData.jenis_kelamin, updateData.agama,
      updateData.no_telepon, nis]);

    res.json({ message: 'Data siswa berhasil diperbarui.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const [rows] = await db.query(`SELECT * FROM siswa WHERE nis = ?`, [nis]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan.' });
    }

    res.json(rows[0]);
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
