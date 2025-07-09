const db = require('../database/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'token-jwt';
const crypto = require('crypto');

// CREATE - Tambah Tahun Akademik
const tambahTahunAkademik = async (req, res) => {
  // Ambil data yang diperlukan dari body request.
  const { kurikulum_id, tahun_mulai, tahun_berakhir } = req.body;

  // Validasi input
  if (!kurikulum_id || !tahun_mulai || !tahun_berakhir) {
    return res.status(400).json({ message: 'Field kurikulum_id, tahun_mulai, dan tahun_berakhir wajib diisi!' });
  }

  try {
    // 1. Periksa apakah kurikulum ada untuk memberikan pesan error yang jelas
    const [kurikulum] = await db.query(
      `SELECT nama_kurikulum FROM kurikulum WHERE kurikulum_id = ?`, 
      [kurikulum_id]
    );

    if (kurikulum.length === 0) {
      return res.status(404).json({ message: 'Kurikulum tidak ditemukan.' });
    }

    // 2. Panggil Stored Procedure untuk memasukkan data.
    // Logika pembuatan ID dan status ditangani sepenuhnya di dalam SP.
    await db.query(
      `CALL admin_create_tahun_akademik(?, ?, ?)`,
      [kurikulum_id, tahun_mulai, tahun_berakhir]
    );
    
    // 3. Ambil data yang baru saja dibuat untuk dikirim kembali dalam respons.
    //    Kita mengambil baris terakhir yang dimasukkan untuk kurikulum ini
    //    berdasarkan kolom `created_at` untuk memastikan kita mendapatkan data yang benar.
    const [newData] = await db.query(
        `SELECT t.*, k.nama_kurikulum 
         FROM tahun_akademik t 
         JOIN kurikulum k ON t.kurikulum_id = k.kurikulum_id 
         WHERE t.kurikulum_id = ?
         ORDER BY t.created_at DESC
         LIMIT 1`,
        [kurikulum_id]
    );

    // 4. Kirim respons sukses beserta data yang baru dibuat
    res.status(201).json({
      message: 'Tahun akademik berhasil ditambahkan.',
      data: newData[0]
    });

  } catch (error) {
    console.error("Error saat menambahkan tahun akademik:", error);
    res.status(500).json({ 
      message: 'Gagal menambahkan tahun akademik.', 
      error: error.message 
    });
  }
};


// READ - Ambil Semua Tahun Akademik
const getAllTahunAkademik = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, k.nama_kurikulum 
       FROM tahun_akademik t 
       JOIN kurikulum k ON t.kurikulum_id = k.kurikulum_id 
       ORDER BY t.created_at DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data tahun akademik.' });
  }
};

// READ - Ambil Tahun Akademik by ID
const getTahunAkademikById = async (req, res) => {
  // Ambil tahun_akademik_id dan kurikulum_id dari params
  const { tahun_akademik_id, kurikulum_id } = req.params;

  try {
    // Panggil Stored Procedure untuk mengambil data.
    // Stored procedure ini dirancang untuk dapat mencari berdasarkan kedua ID.
    const [rows] = await db.query(
      `CALL sp_read_tahun_akademik(?, ?)`,
      [tahun_akademik_id, kurikulum_id]
    );

    // Hasil dari stored procedure mungkin dalam bentuk array of arrays jika ada hasil tambahan,
    // jadi kita perlu mengambil array pertama yang berisi data yang sebenarnya.
    const data = rows[0]; // Ambil set hasil pertama

    if (data.length === 0) return res.status(404).json({ message: 'Tahun akademik tidak ditemukan.' });

    res.status(200).json(data[0]);
  } catch (err) {
    console.error("Error saat mengambil tahun akademik berdasarkan ID:", err);
    res.status(500).json({ message: 'Gagal mengambil data tahun akademik.' });
  }
};
// UPDATE - Edit Tahun Akademik
const updateTahunAkademik = async (req, res) => {
  const { tahun_mulai, tahun_berakhir, status } = req.body;
  // Ambil tahun_akademik_id dari params (ini adalah p_ta_id_lama)
  // Ambil kurikulum_id lama dari params (ini adalah p_kurikulum_id_lama)
  const { tahun_akademik_id, kurikulum_id: old_kurikulum_id } = req.params;
  // Ambil kurikulum_id baru dari body (ini adalah p_kurikulum_id)
  const { kurikulum_id: new_kurikulum_id } = req.body;


  // Validasi input
  if (!new_kurikulum_id || !tahun_mulai || !tahun_berakhir || !status) {
    return res.status(400).json({ message: 'Semua field (kurikulum_id, tahun_mulai, tahun_berakhir, status) wajib diisi!' });
  }

  try {
    // 1. Periksa apakah kurikulum baru ada
    const [kurikulum] = await db.query(`SELECT nama_kurikulum FROM kurikulum WHERE kurikulum_id = ?`, [new_kurikulum_id]);
    if (kurikulum.length === 0) {
      return res.status(400).json({ message: 'Kurikulum baru tidak ditemukan.' });
    }

    // 2. Panggil Stored Procedure untuk memperbarui data
    await db.query(
      `CALL admin_update_tahun_akademik(?, ?, ?, ?, ?, ?)`,
      [
        tahun_akademik_id,      // p_ta_id_lama
        old_kurikulum_id,       // p_kurikulum_id_lama (dari params)
        new_kurikulum_id,       // p_kurikulum_id (baru, dari body)
        tahun_mulai,            // p_ta_mulai
        tahun_berakhir,         // p_ta_berakhir
        status                  // p_ta_status
      ]
    );

    // 3. Ambil data yang baru saja diperbarui untuk dikirim kembali dalam respons.
    // Karena stored procedure dapat mengubah tahun_akademik_id, kita perlu mencari
    // data berdasarkan tahun_mulai, tahun_berakhir, dan kurikulum_id yang baru
    // atau mengambil baris terakhir yang diperbarui jika ada cara unik lainnya.
    // Untuk keandalan, kita akan mengambil data yang paling sesuai dengan input baru.
    const [updatedData] = await db.query(
        `SELECT t.*, k.nama_kurikulum
         FROM tahun_akademik t
         JOIN kurikulum k ON t.kurikulum_id = k.kurikulum_id
         WHERE t.kurikulum_id = ? AND t.tahun_mulai = ? AND t.tahun_berakhir = ?
         ORDER BY t.created_at DESC
         LIMIT 1`, // Mengambil yang paling baru jika ada duplikat berdasarkan kriteria ini
        [new_kurikulum_id, tahun_mulai, tahun_berakhir]
    );

    if (updatedData.length === 0) {
        return res.status(500).json({ message: 'Gagal mengambil data tahun akademik yang diperbarui.' });
    }

    res.status(200).json({
      message: 'Tahun akademik berhasil diperbarui.',
      data: updatedData[0]
    });
  } catch (err) {
    console.error("Error saat memperbarui tahun akademik:", err);
    res.status(500).json({ message: 'Gagal memperbarui tahun akademik.', error: err.message });
  }
};

// DELETE - Hapus Tahun Akademik
const hapusTahunAkademik = async (req, res) => {
  // Ambil tahun_akademik_id dan kurikulum_id dari params
  const { tahun_akademik_id, kurikulum_id } = req.params;

  try {
    // 1. Cek keberadaan tahun akademik sebelum menghapus
    const [cek] = await db.query(`SELECT * FROM tahun_akademik WHERE tahun_akademik_id = ? AND kurikulum_id = ?`, [tahun_akademik_id, kurikulum_id]);
    if (cek.length === 0) return res.status(404).json({ message: 'Tahun akademik tidak ditemukan atau tidak cocok dengan kurikulum_id yang diberikan.' });

    // 2. Panggil Stored Procedure untuk menghapus data
    await db.query(
      `CALL admin_delete_tahun_akademik(?, ?)`,
      [tahun_akademik_id, kurikulum_id]
    );

    res.status(200).json({ message: 'Tahun akademik berhasil dihapus.' });
  } catch (err) {
    console.error("Error saat menghapus tahun akademik:", err);
    res.status(500).json({ message: 'Gagal menghapus tahun akademik.', error: err.message });
  }
};

module.exports = {
  tambahTahunAkademik,
  getAllTahunAkademik,
  getTahunAkademikById,
  updateTahunAkademik,
  hapusTahunAkademik
};
