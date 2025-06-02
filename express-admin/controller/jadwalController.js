const db = require('../database/db');
const { v4: uuidv4 } = require('uuid'); // Diperlukan untuk generate ID unik

// const jwt = require('jsonwebtoken'); // Tidak digunakan secara langsung di snippet ini
// const bcrypt = require('bcryptjs'); // Tidak digunakan secara langsung di snippet ini
// const JWT_SECRET = 'token-jwt'; // Tidak digunakan secara langsung di snippet ini
// const crypto = require('crypto'); // Tidak digunakan secara langsung di snippet ini

// Helper SQL Injection sederhana (dipertahankan dari kode asli)
const containsSQLInjection = (input) => {
  if (typeof input !== 'string') {
    return false;
  }
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Jadwal
// Menggunakan SP admin_create_master_jadwal untuk tabel master_jadwal.
// Untuk tabel 'jadwal', sekarang juga akan men-generate jadwal_id.
const tambahJadwal = async (req, res) => {
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field (mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish) wajib diisi!' });
  }

  const hariInt = parseInt(hari, 10);
  if (isNaN(hariInt) || hariInt < 1 || hariInt > 7) { // Asumsi hari 1-7 (Senin-Minggu)
      return res.status(400).json({ message: "'hari' harus berupa angka antara 1 dan 7." });
  }

  try {
    // Pertimbangkan untuk menggunakan transaksi database di sini
    // await db.query('START TRANSACTION'); 

    // 1. Generate master_jadwal_id menggunakan UUID
    const master_jadwal_id = uuidv4();

    // 2. Panggil SP untuk insert ke master_jadwal
    await db.query(
      'CALL admin_create_master_jadwal(?, ?, ?, ?)',
      [master_jadwal_id, jam_ke, start, finish]
    );

    // 3. Generate jadwal_id baru menggunakan UUID
    const jadwal_id_baru = uuidv4();

    // 4. Insert ke tabel jadwal menggunakan master_jadwal_id dan jadwal_id_baru
    // Tidak ada SP 'admin_create_jadwal' yang disediakan, jadi menggunakan query langsung.
    // Sekarang menyertakan jadwal_id_baru dalam INSERT.
    await db.query( // Tidak perlu mengambil resultJadwal jika ID sudah di-generate
      `INSERT INTO jadwal (jadwal_id, master_jadwal_id, mapel_id, kelas_id, hari, ruangan, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [jadwal_id_baru, master_jadwal_id, mapel_id, kelas_id, hariInt, ruangan]
    );

    // await db.query('COMMIT');
    // Mengembalikan jadwal_id_baru yang di-generate oleh aplikasi
    res.status(201).json({ message: 'Jadwal berhasil ditambahkan.', jadwal_id: jadwal_id_baru, master_jadwal_id: master_jadwal_id });
  } catch (error) {
    // await db.query('ROLLBACK');
    console.error('Error in tambahJadwal:', error);
    res.status(500).json({ message: 'Gagal menambahkan jadwal.', error: error.message });
  }
};

// READ - Ambil Semua Jadwal
// Tidak ada SP yang disediakan yang cocok dengan output dan join dari query ini.
// Menggunakan implementasi query langsung seperti kode asli.
const getAllJadwal = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        j.jadwal_id, 
        j.ruangan,
        j.hari,
        mj.master_jadwal_id,
        mj.jam_ke, 
        DATE_FORMAT(mj.start, '%H:%i') AS start_time, 
        DATE_FORMAT(mj.finish, '%H:%i') AS finish_time,
        m.nama_mapel, 
        g.nama_guru, 
        k.nama_kelas,
        k.jenjang,
        k.tingkat
      FROM jadwal j
      JOIN master_jadwal mj ON j.master_jadwal_id = mj.master_jadwal_id
      JOIN mapel m ON j.mapel_id = m.mapel_id
      JOIN kelas k ON j.kelas_id = k.kelas_id
      JOIN guru g ON k.guru_nip = g.nip
      ORDER BY j.hari, mj.jam_ke 
    `);
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error in getAllJadwal:', error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};

// READ - Ambil Jadwal Berdasarkan kelas_id dan hari (menggunakan SP sp_read_jadwal_by_kelas_id)
// CATATAN: Fungsi ini sebelumnya bernama getJadwalById dan mengambil jadwal_id dari req.params.
// Sekarang fungsi ini mengambil kelas_id dan hari (opsional) dari req.query.
// Nama fungsi dipertahankan sesuai permintaan, namun perilakunya telah berubah secara signifikan.
// READ - Ambil Jadwal Berdasarkan kelas_id dan hari (menggunakan SP sp_read_jadwal_by_kelas_id)
// CATATAN: Fungsi ini sebelumnya bernama getJadwalById dan mengambil jadwal_id dari req.params.
// Sekarang fungsi ini mengambil kelas_id dan hari (opsional) dari req.query.
// Nama fungsi dipertahankan sesuai permintaan, namun perilakunya telah berubah secara signifikan.
const getJadwalById = async (req, res) => {
  const { kelas_id, hari } = req.query; // Mengambil parameter dari query string

  if (!kelas_id) {
    return res.status(400).json({ message: "Parameter 'kelas_id' wajib diisi dalam query string." });
  }

  let hariIntOrNull = null;
  if (hari !== undefined && hari !== null && hari !== '') {
    hariIntOrNull = parseInt(hari, 10);
    if (isNaN(hariIntOrNull)) {
      return res.status(400).json({ message: "Parameter 'hari' jika diisi harus berupa angka." });
    }
  }

  try {
    // Panggil stored procedure sp_read_jadwal_by_kelas_id
    // SP ini akan mengembalikan array jadwal untuk kelas tersebut, difilter berdasarkan hari jika disediakan.
    const [rows] = await db.query(
      'CALL sp_read_jadwal_by_kelas_id(?, ?)', 
      [kelas_id, hariIntOrNull]
    );

    // rows[0] akan berisi array hasil dari SELECT di dalam SP
    if (rows[0].length === 0) {
      // Tidak ada jadwal yang ditemukan untuk kelas_id dan hari yang diberikan
      return res.status(404).json({ message: 'Jadwal tidak ditemukan untuk kelas dan hari yang spesifik.' });
    }

    // Mengembalikan array jadwal yang ditemukan (sesuai dengan kolom yang di-SELECT oleh SP)
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error in getJadwalById (now getJadwalByKelasIdAndHari):', error);
    res.status(500).json({ message: 'Gagal mengambil data jadwal.', error: error.message });
  }
};

// UPDATE - Edit Jadwal
// Menggunakan SP admin_update_jadwal untuk tabel 'jadwal'
// dan query langsung untuk tabel 'master_jadwal'.
const updateJadwal = async (req, res) => {
  const { jadwal_id } = req.params;
  const { mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish } = req.body;

  if (!jadwal_id) {
    return res.status(400).json({ message: 'Parameter jadwal_id wajib diisi.' });
  }
  if (!mapel_id || !kelas_id || !ruangan || !hari || !jam_ke || !start || !finish) {
    return res.status(400).json({ message: 'Semua field (mapel_id, kelas_id, ruangan, hari, jam_ke, start, finish) wajib diisi!' });
  }

  const hariInt = parseInt(hari, 10);
  if (isNaN(hariInt) || hariInt < 1 || hariInt > 7) { // Asumsi hari 1-7 (Senin-Minggu)
      return res.status(400).json({ message: "'hari' harus berupa angka antara 1 dan 7." });
  }

  try {
    // 1. Cek apakah jadwal ada dan ambil master_jadwal_id terkait
    const [jadwalRows] = await db.query('SELECT master_jadwal_id FROM jadwal WHERE jadwal_id = ?', [jadwal_id]);
    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    }
    const current_master_jadwal_id = jadwalRows[0].master_jadwal_id;
    
    // Pertimbangkan untuk menggunakan transaksi database di sini
    // await db.query('START TRANSACTION');

    // 2. Update tabel master_jadwal (jam_ke, start, finish) - Tidak ada SP untuk ini
    await db.query(
      `UPDATE master_jadwal SET jam_ke=?, start=?, finish=? WHERE master_jadwal_id=?`,
      [jam_ke, start, finish, current_master_jadwal_id]
    );

    // 3. Panggil SP untuk update tabel jadwal
    // Parameter in_master_jadwal pada SP adalah master_jadwal_id yang menjadi FK di tabel jadwal.
    // Kita tidak mengubah FK ini, jadi kita kirimkan current_master_jadwal_id.
    await db.query(
      'CALL admin_update_jadwal(?, ?, ?, ?, ?, ?)',
      [jadwal_id, current_master_jadwal_id, mapel_id, kelas_id, hariInt, ruangan]
    );
    
    // await db.query('COMMIT');
    res.status(200).json({ message: 'Jadwal berhasil diperbarui.' });
  } catch (error) {
    // await db.query('ROLLBACK');
    console.error('Error in updateJadwal:', error);
    res.status(500).json({ message: 'Gagal memperbarui jadwal.', error: error.message });
  }
};

// DELETE - Hapus Jadwal
// Menggunakan SP admin_delete_jadwal untuk tabel 'jadwal'
// dan query langsung untuk tabel 'master_jadwal'.
const hapusJadwal = async (req, res) => {
  const { jadwal_id } = req.params;

  if (!jadwal_id) {
    return res.status(400).json({ message: 'Parameter jadwal_id wajib diisi.' });
  }

  try {
    // 1. Ambil master_jadwal_id dari jadwal yang akan dihapus
    const [jadwalRows] = await db.query(`SELECT master_jadwal_id FROM jadwal WHERE jadwal_id = ?`, [jadwal_id]);
    if (jadwalRows.length === 0) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan.' });
    }
    const master_jadwal_id_to_delete = jadwalRows[0].master_jadwal_id;

    // Pertimbangkan untuk menggunakan transaksi database di sini
    // await db.query('START TRANSACTION');

    // 2. Panggil SP untuk menghapus dari tabel jadwal
    await db.query('CALL admin_delete_jadwal(?)', [jadwal_id]);
    
    // 3. Hapus dari tabel master_jadwal secara manual (Tidak ada SP untuk ini)
    // Ini penting untuk menghindari data yatim piatu, dengan asumsi 1 master_jadwal hanya untuk 1 jadwal.
    // Jika master_jadwal bisa di-share oleh beberapa jadwal, logika ini perlu dipertimbangkan ulang.
    await db.query(`DELETE FROM master_jadwal WHERE master_jadwal_id = ?`, [master_jadwal_id_to_delete]);

    // await db.query('COMMIT');
    res.status(200).json({ message: 'Jadwal berhasil dihapus.' });
  } catch (error) {
    // await db.query('ROLLBACK');
    console.error('Error in hapusJadwal:', error);
    res.status(500).json({ message: 'Gagal menghapus jadwal.', error: error.message });
  }
};
  
module.exports = {
  tambahJadwal,
  getAllJadwal,
  getJadwalById, // Nama fungsi dipertahankan, tetapi perilakunya berubah
  updateJadwal,
  hapusJadwal
};
