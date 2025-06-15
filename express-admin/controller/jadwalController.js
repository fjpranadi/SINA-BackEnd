const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');
const { randomBytes } = require('crypto');

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
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ 
      message: 'Semua field (mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish) wajib diisi!' 
    });
  }

  try {
    // Generate IDs
    const master_jadwal_id = randomBytes(8).readBigUInt64BE().toString();
    const jadwal_id = randomBytes(8).readBigUInt64BE().toString();
    
    // Start transaction for atomic operations
    await db.query('START TRANSACTION');

    try {
      // 1. Insert to master_jadwal with generated ID
      await db.query(
        `INSERT INTO master_jadwal 
         (master_jadwal_id, jam_ke, start, finish, created_at) 
         VALUES (?, ?, ?, ?, NOW())`,
        [master_jadwal_id, jam_ke, start, finish]
      );

      // 2. Insert to jadwal with generated ID
      await db.query(
        `INSERT INTO jadwal 
         (jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan]
      );

      // Commit transaction if both inserts succeed
      await db.query('COMMIT');

      res.status(201).json({ 
        message: 'Jadwal berhasil ditambahkan.',
        jadwal_id: jadwal_id,
        master_jadwal_id: master_jadwal_id
      });

    } catch (error) {
      // Rollback if any error occurs
      await db.query('ROLLBACK');
      
      // Handle duplicate IDs (retry logic could be added here if needed)
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          message: 'ID sudah digunakan, silakan coba lagi'
        });
      }
      throw error;
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menambahkan jadwal.', 
      error: error.message 
    });
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
    const { kelas_id } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.master_jadwal_id,
        j.mapel_id,
        j.kelas_id,
        j.hari,
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
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip
      WHERE j.kelas_id = ?
      ORDER BY j.hari, mj.jam_ke
    `, [kelas_id]);

    if (rows.length === 0) {
      return res.status(404).json({ 
        message: 'Tidak ada jadwal ditemukan untuk kelas ini atau kelas tidak ditemukan.' 
      });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal mengambil data jadwal.', 
      error: error.message 
    });
  }
};

// UPDATE - Edit Jadwal
// UPDATE - Edit Jadwal (tanpa validasi wajib isi semua field)
const updateJadwal = async (req, res) => {
  const { jadwal_id } = req.params;
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  try {
    // 1. Cek apakah jadwal ada dan ambil master_jadwal_id terkait
    const [jadwalRows] = await db.query('SELECT master_jadwal_id FROM jadwal WHERE jadwal_id = ?', [jadwal_id]);
    if (jadwalRows.length === 0) {
        return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    }
    const master_jadwal_id = jadwalRows[0].master_jadwal_id;
    
    // 2. Update tabel jadwal (hanya field yang ada nilainya)
    const jadwalUpdates = [];
    const jadwalParams = [];
    
    if (mapel_id !== undefined) {
      jadwalUpdates.push('mapel_id = ?');
      jadwalParams.push(mapel_id);
    }
    if (kelas_id !== undefined) {
      jadwalUpdates.push('kelas_id = ?');
      jadwalParams.push(kelas_id);
    }
    if (ruangan !== undefined) {
      jadwalUpdates.push('ruangan = ?');
      jadwalParams.push(ruangan);
    }
    if (hari !== undefined) {
      jadwalUpdates.push('hari = ?');
      jadwalParams.push(hari);
    }
    
    if (jadwalUpdates.length > 0) {
      jadwalParams.push(jadwal_id);
      await db.query(
        `UPDATE jadwal SET ${jadwalUpdates.join(', ')} WHERE jadwal_id = ?`,
        jadwalParams
      );
    }

    // 3. Update tabel master_jadwal (hanya field yang ada nilainya)
    const masterUpdates = [];
    const masterParams = [];
    
    if (jam_ke !== undefined) {
      masterUpdates.push('jam_ke = ?');
      masterParams.push(jam_ke);
    }
    if (start !== undefined) {
      masterUpdates.push('start = ?');
      masterParams.push(start);
    }
    if (finish !== undefined) {
      masterUpdates.push('finish = ?');
      masterParams.push(finish);
    }
    
    if (masterUpdates.length > 0) {
      masterParams.push(master_jadwal_id);
      await db.query(
        `UPDATE master_jadwal SET ${masterUpdates.join(', ')} WHERE master_jadwal_id = ?`,
        masterParams
      );
    }

    res.status(200).json({ message: 'Jadwal berhasil diperbarui.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Gagal memperbarui jadwal.', error: error.message });
  }
};


const getJadwalByJadwalId = async (req, res) => {
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

// DELETE - Hapus Semua Jadwal Berdasarkan Kelas ID
const hapusJadwalByKelasId = async (req, res) => {
  const { kelas_id } = req.params;

  if (!kelas_id) {
    return res.status(400).json({ message: 'kelas_id wajib diisi.' });
  }

  try {
    // 1. Ambil semua master_jadwal_id yang terkait dengan kelas_id
    // Ini penting agar kita bisa menghapus entri di tabel master_jadwal juga.
    const [jadwalRows] = await db.query(
      `SELECT master_jadwal_id FROM jadwal WHERE kelas_id = ?`,
      [kelas_id]
    );

    // Jika tidak ada jadwal yang ditemukan untuk kelas tersebut, kirim respons 404.
    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Tidak ada jadwal yang ditemukan untuk kelas ini.' });
    }

    // Kumpulkan semua ID master_jadwal yang akan dihapus.
    const masterJadwalIds = jadwalRows.map(j => j.master_jadwal_id);

    // 2. Gunakan transaksi untuk memastikan kedua operasi (delete) berhasil atau tidak sama sekali.
    await db.query('START TRANSACTION');

    try {
      // 3. Hapus semua entri dari tabel 'jadwal' yang cocok dengan kelas_id.
      // Ini sama dengan logika pada Stored Procedure Anda.
      await db.query(
        `DELETE FROM jadwal WHERE kelas_id = ?`, 
        [kelas_id]
      );

      // 4. Hapus semua entri dari tabel 'master_jadwal' yang terkait.
      // Ini mencegah data 'master_jadwal' menjadi yatim piatu (orphaned).
      await db.query(
        `DELETE FROM master_jadwal WHERE master_jadwal_id IN (?)`,
        [masterJadwalIds]
      );

      // 5. Jika kedua operasi berhasil, commit transaksi.
      await db.query('COMMIT');

      res.status(200).json({ message: `Semua jadwal untuk kelas ID ${kelas_id} berhasil dihapus.` });

    } catch (error) {
      // Jika terjadi error di tengah transaksi, rollback semua perubahan.
      await db.query('ROLLBACK');
      throw error; // Lemparkan error agar ditangkap oleh blok catch luar.
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: 'Gagal menghapus jadwal berdasarkan kelas.', 
      error: error.message 
    });
  }
};
 
module.exports = {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal,
  getJadwalByJadwalId,
  hapusJadwalByKelasId
};