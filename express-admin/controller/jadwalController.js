const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
  if (typeof input !== 'string') {
    return false;
  }
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Jadwal
const tambahJadwal = async (req, res) => {
  // 'hari' sekarang akan di-handle untuk tabel 'jadwal'
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  // Validasi, termasuk 'hari'
  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field (mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish) wajib diisi!' });
  }

  // Asumsi 'hari' adalah INT sesuai skema Anda. Jika perlu validasi tipe, tambahkan di sini.

  try {
    // 1. Insert ke master_jadwal terlebih dahulu untuk mendapatkan master_jadwal_id
    const [resultMasterJadwal] = await db.query(
      `INSERT INTO master_jadwal (jam_ke, start, finish, created_at) VALUES (?, ?, ?, NOW())`,
      [jam_ke, start, finish]
    );
    const master_jadwal_id = resultMasterJadwal.insertId;

    // 2. Insert ke jadwal menggunakan master_jadwal_id yang baru dibuat dan 'hari'
    const [resultJadwal] = await db.query(
      `INSERT INTO jadwal (master_jadwal_id, mapel_id, kelas_id, hari, ruangan, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [master_jadwal_id, mapel_id, kelas_id, hari, ruangan]
    );

    res.status(201).json({ message: 'Jadwal berhasil ditambahkan.', jadwal_id: resultJadwal.insertId, master_jadwal_id: master_jadwal_id });
  } catch (error) {
    console.error(error);
    // Pertimbangkan untuk menghapus master_jadwal yang mungkin sudah terbuat jika insert jadwal gagal (memerlukan transaksi)
    res.status(500).json({ message: 'Gagal menambahkan jadwal.', error: error.message });
  }
};

// READ - Ambil Semua Jadwal
const getAllJadwal = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.ruangan,
        j.hari,  -- Mengambil 'hari' dari tabel jadwal
        mj.master_jadwal_id,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel, 
        g.nama_guru,  -- Nama wali kelas
        k.nama_kelas,
        k.jenjang,
        k.tingkat
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id -- Join ke master_jadwal
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip -- Join ke guru via kelas untuk wali kelas
      ORDER BY j.hari, mj.jam_ke 
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};

// READ - Ambil Jadwal Berdasarkan jadwal_id
const getJadwalById = async (req, res) => {
  const { jadwal_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.master_jadwal_id,
        j.mapel_id,
        j.kelas_id,
        j.hari,     -- Mengambil 'hari' dari tabel jadwal
        j.ruangan,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel,
        g.nama_guru, -- Nama wali kelas
        k.nama_kelas,
        k.jenjang,
        k.tingkat
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id -- Join ke master_jadwal
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip -- Join ke guru via kelas untuk wali kelas
      WHERE j.jadwal_id = ?
    `, [jadwal_id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};

// UPDATE - Edit Jadwal
const updateJadwal = async (req, res) => {
  const { jadwal_id } = req.params;
  // 'hari' sekarang akan di-handle untuk tabel 'jadwal'
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  // Validasi, termasuk 'hari'
  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field (mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish) wajib diisi!' });
  }

  try {
    // 1. Cek apakah jadwal ada dan ambil master_jadwal_id terkait
    const [jadwalRows] = await db.query('SELECT master_jadwal_id FROM jadwal WHERE jadwal_id = ?', [jadwal_id]);
    if (jadwalRows.length === 0) {
        return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    }
    const master_jadwal_id = jadwalRows[0].master_jadwal_id;
    
    // 2. Update tabel jadwal (termasuk 'hari')
    await db.query(
      `UPDATE jadwal SET mapel_id=?, kelas_id=?, ruangan=?, hari=? WHERE jadwal_id=?`,
      [mapel_id, kelas_id, ruangan, hari, jadwal_id]
    );

    // 3. Update tabel master_jadwal
    await db.query(
      `UPDATE master_jadwal SET jam_ke=?, start=?, finish=? WHERE master_jadwal_id=?`,
      [jam_ke, start, finish, master_jadwal_id]
    );

    res.status(200).json({ message: 'Jadwal berhasil diperbarui.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui jadwal.', error: error.message });
  }
};

// DELETE - Hapus Jadwal
const hapusJadwal = async (req, res) => {
  const { jadwal_id } = req.params;

  try {
    // 1. Ambil master_jadwal_id dari jadwal yang akan dihapus
    const [jadwalRows] = await db.query(`SELECT master_jadwal_id FROM jadwal WHERE jadwal_id = ?`, [jadwal_id]);
    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    }
    const master_jadwal_id = jadwalRows[0].master_jadwal_id;

    // 2. Hapus dari tabel jadwal terlebih dahulu (atau sesuaikan urutan berdasarkan foreign key constraint Anda)
    // Jika jadwal.master_jadwal_id memiliki ON DELETE CASCADE, maka master_jadwal akan terhapus otomatis.
    // Jika tidak, atau untuk kontrol lebih, hapus secara manual.
    await db.query(`DELETE FROM jadwal WHERE jadwal_id = ?`, [jadwal_id]);
    
    // 3. Hapus dari tabel master_jadwal
    // Ini hanya aman jika tidak ada jadwal lain yang menggunakan master_jadwal_id ini.
    // Jika master_jadwal bisa di-share, logika ini perlu dipertimbangkan ulang.
    // Untuk kasus ini, asumsi 1 jadwal memiliki 1 master_jadwal unik.
    await db.query(`DELETE FROM master_jadwal WHERE master_jadwal_id = ?`, [master_jadwal_id]);


    res.status(200).json({ message: 'Jadwal berhasil dihapus.' });
  } catch (error) {
    console.error(error);
    // Pertimbangkan transaksi di sini
    res.status(500).json({ message: 'Gagal menghapus jadwal.', error: error.message });
  }
};
 
module.exports = {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal
};