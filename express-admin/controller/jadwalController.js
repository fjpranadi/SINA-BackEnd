const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// Helper SQL Injection sederhana
const containsSQLInjection = (input) => {
    const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
    return forbiddenWords.some(word => input.toLowerCase().includes(word));
  };
// CREATE - Tambah Jadwal
const tambahJadwal = async (req, res) => {
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO jadwal (mapel_id, kelas_id, ruangan, created_at) VALUES (?, ?, ?, NOW())`,
      [mapel_id, kelas_id, ruangan]
    );

    const jadwal_id = result.insertId;

    await db.query(
      `INSERT INTO master_jadwal (jadwal_id, hari, jam_ke, start, finish, created_at) VALUES (?, ?, ?, ?, ?, NOW())`,
      [jadwal_id, hari, jam_ke, start, finish]
    );

    res.status(201).json({ message: 'Jadwal berhasil ditambahkan.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal menambahkan jadwal.', error: error.message });
  }
};

// READ - Ambil Semua Jadwal
const getAllJadwal = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, j.ruangan, 
        mj.hari, mj.jam_ke, mj.start, mj.finish,
        m.nama_mapel, 
        g.nama_guru, 
        k.nama_kelas
      FROM jadwal j
      JOIN master_jadwal mj ON j.jadwal_id = mj.jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip
      ORDER BY mj.hari, mj.jam_ke
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
        j.jadwal_id, j.ruangan,
        mj.hari, mj.jam_ke, mj.start, mj.finish,
        m.nama_mapel,
        g.nama_guru,
        k.nama_kelas
      FROM jadwal j
      JOIN master_jadwal mj ON j.jadwal_id = mj.jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip
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
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field wajib diisi!' });
  }

  try {
    await db.query(
      `UPDATE jadwal SET mapel_id=?, kelas_id=?, ruangan=? WHERE jadwal_id=?`,
      [mapel_id, kelas_id, ruangan, jadwal_id]
    );

    await db.query(
      `UPDATE master_jadwal SET hari=?, jam_ke=?, start=?, finish=? WHERE jadwal_id=?`,
      [hari, jam_ke, start, finish, jadwal_id]
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
    const [cek] = await db.query(`SELECT * FROM jadwal WHERE jadwal_id = ?`, [jadwal_id]);
    if (cek.length === 0) return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });

    await db.query(`DELETE FROM master_jadwal WHERE jadwal_id = ?`, [jadwal_id]);
    await db.query(`DELETE FROM jadwal WHERE jadwal_id = ?`, [jadwal_id]);

    res.status(200).json({ message: 'Jadwal berhasil dihapus.' });
  } catch (error) {
    console.error(error);
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
