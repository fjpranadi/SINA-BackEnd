const db = require('../database/db');

// --- API UNTUK MENGAMBIL JUMLAH GURU ---
exports.getCountGuru = async (req, res) => {
  try {
    // 1. Menjalankan stored procedure sp_count_guru
    const [result] = await db.query("CALL sp_count_guru()");

    // 2. Mengekstrak nilai hitungan dari hasil query
    const count = result[0][0].total_guru;

    // 3. Menyusun objek respons
    const responseData = {
      total_guru: count
    };

    // 4. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 5. Penanganan error
    console.error('Error di getCountGuru:', error);
    res.status(500).json({
      message: 'Gagal mengambil data jumlah guru.',
      error: error.message
    });
  }
};

// --- API UNTUK MENGAMBIL JUMLAH SISWA ---
exports.getCountSiswa = async (req, res) => {
  try {
    // 1. Menjalankan stored procedure sp_count_siswa
    const [result] = await db.query("CALL sp_count_siswa()");

    // 2. Mengekstrak nilai hitungan dari hasil query
    const count = result[0][0].total_siswa;

    // 3. Menyusun objek respons
    const responseData = {
      total_siswa: count
    };

    // 4. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 5. Penanganan error
    console.error('Error di getCountSiswa:', error);
    res.status(500).json({
      message: 'Gagal mengambil data jumlah siswa.',
      error: error.message
    });
  }
};

// --- API UNTUK MENGAMBIL JUMLAH ADMIN ---
exports.getCountAdmin = async (req, res) => {
  try {
    // 1. Menjalankan stored procedure sp_count_admin
    const [result] = await db.query("CALL sp_count_admin()");

    // 2. Mengekstrak nilai hitungan dari hasil query
    const count = result[0][0].total_admin;

    // 3. Menyusun objek respons
    const responseData = {
      total_admin: count
    };

    // 4. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 5. Penanganan error
    console.error('Error di getCountAdmin:', error);
    res.status(500).json({
      message: 'Gagal mengambil data jumlah admin.',
      error: error.message
    });
  }
};

// --- API UNTUK MENGAMBIL JUMLAH PENGUMUMAN ---
exports.getCountPengumuman = async (req, res) => {
  try {
    // 1. Menjalankan stored procedure sp_count_pengumuman
    const [result] = await db.query("CALL sp_count_pengumuman()");

    // 2. Mengekstrak nilai hitungan dari hasil query
    const count = result[0][0].total_pengumuman;

    // 3. Menyusun objek respons
    const responseData = {
      total_pengumuman: count
    };

    // 4. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 5. Penanganan error
    console.error('Error di getCountPengumuman:', error);
    res.status(500).json({
      message: 'Gagal mengambil data jumlah pengumuman.',
      error: error.message
    });
  }
};

// --- [BARU] API UNTUK MENGAMBIL JUMLAH ABSENSI GURU HARI INI ---
exports.getCountAbsenGuru = async (req, res) => {
  try {
    // 1. Menjalankan stored procedure admin_count_absen_guru
    const [result] = await db.query("CALL admin_count_absen_guru()");

    // 2. Mengekstrak nilai hitungan dari hasil query
    // Hasilnya adalah objek tunggal di dalam array pertama
    const countData = result[0][0];

    // 3. Menyusun objek respons
    // Mengonversi nilai BigInt menjadi Number untuk kompatibilitas JSON
    const responseData = {
      total_absen_guru: Number(countData.total_absen_guru),
      hadir: Number(countData.hadir),
      izin: Number(countData.izin),
      sakit: Number(countData.sakit),
      alpa: Number(countData.alpa)
    };

    // 4. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 5. Penanganan error
    console.error('Error di getCountAbsenGuru:', error);
    res.status(500).json({
      message: 'Gagal mengambil data absensi guru.',
      error: error.message
    });
  }
};

// --- [BARU] API UNTUK MENGAMBIL JUMLAH ABSENSI SISWA HARI INI ---
exports.getCountAbsenSiswa = async (req, res) => {
  try {
    // 1. Mengambil parameter `kelas_id` dari query string (opsional)
    const { kelas_id } = req.query;

    // 2. Menjalankan stored procedure admin_count_absen_siswa dengan parameter
    // Menggunakan placeholder (?) untuk keamanan dari SQL Injection
    // Jika kelas_id tidak ada (undefined), teruskan null ke SP
    const [result] = await db.query("CALL admin_count_absen_siswa(?)", [kelas_id || null]);

    // 3. Mengekstrak nilai hitungan dari hasil query
    const countData = result[0][0];

    // 4. Menyusun objek respons
    // Mengonversi nilai BigInt menjadi Number
    const responseData = {
      total_absen_siswa: Number(countData.total_absen_siswa),
      hadir: Number(countData.hadir),
      izin: Number(countData.izin),
      sakit: Number(countData.sakit),
      alpa: Number(countData.alpa)
    };

    // 5. Mengirim data sebagai respons JSON
    res.status(200).json(responseData);

  } catch (error) {
    // 6. Penanganan error
    console.error('Error di getCountAbsenSiswa:', error);
    res.status(500).json({
      message: 'Gagal mengambil data absensi siswa.',
      error: error.message
    });
  }
};