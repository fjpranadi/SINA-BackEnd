const db = require('../database/db');
const { v4: uuidv4 } = require('uuid'); // Diperlukan untuk generate mapel_id

// Helper SQL Injection sederhana (opsional, dipertahankan jika Anda menggunakannya)
const containsSQLInjection = (input) => {
  if (typeof input !== 'string') {
    return false;
  }
  const forbiddenWords = ['select', 'insert', 'update', 'delete', 'drop', 'alter', 'create', 'replace', 'truncate'];
  return forbiddenWords.some(word => input.toLowerCase().includes(word));
};

// CREATE - Tambah Mapel (menggunakan SP admin_create_mapel)
const createMapel = async (req, res) => {
  const { nama_mapel, kkm } = req.body;

  // Validasi input dasar
  if (!nama_mapel || kkm === undefined || kkm === null) {
    return res.status(400).json({ message: 'Field nama_mapel dan kkm wajib diisi!' });
  }
  if (typeof nama_mapel !== 'string' || typeof kkm !== 'number') {
      return res.status(400).json({ message: 'Tipe data nama_mapel harus string dan kkm harus angka.' });
  }
  // Contoh penggunaan helper SQL Injection (opsional)
  if (containsSQLInjection(nama_mapel)) {
      return res.status(400).json({ message: 'Input nama_mapel mengandung kata terlarang.' });
  }

  try {
    // Generate mapel_id baru menggunakan UUID
    const mapel_id_baru = uuidv4();

    // Panggil stored procedure admin_create_mapel
    await db.query(
      'CALL admin_create_mapel(?, ?, ?)',
      [mapel_id_baru, nama_mapel, kkm]
    );

    res.status(201).json({ message: 'Mapel berhasil ditambahkan', mapel_id: mapel_id_baru });
  } catch (error) {
    console.error('Error in createMapel:', error);
    res.status(500).json({ message: 'Gagal menambahkan mapel', error: error.message });
  }
};

// READ - Ambil Semua Mapel (menggunakan SP admin_read_mapel)
const getAllMapel = async (req, res) => {
  try {
    // Panggil stored procedure admin_read_mapel dengan NULL untuk mendapatkan semua mapel
    const [rows] = await db.query('CALL admin_read_mapel(NULL)');
    
    // Hasil dari SP ada di elemen pertama array yang dikembalikan oleh query (rows[0])
    // SP admin_read_mapel mengembalikan: m.mapel_id, m.nama_mapel, m.kkm, m.created_at
    const mapelData = rows[0];

    res.status(200).json(mapelData); // Mengembalikan data mentah dari SP
  } catch (error) {
    console.error('Error in getAllMapel:', error);
    res.status(500).json({ message: 'Gagal mengambil data mapel', error: error.message });
  }
};

// READ - Ambil Mapel by ID (menggunakan SP admin_read_mapel)
const getMapelById = async (req, res) => {
  const { id } = req.params; // Mengambil mapel_id dari parameter URL

  if (!id) {
    return res.status(400).json({ message: 'Parameter ID mapel wajib diisi.' });
  }

  try {
    // Panggil stored procedure admin_read_mapel dengan mapel_id
    const [rows] = await db.query('CALL admin_read_mapel(?)', [id]);
    const mapelData = rows[0]; 

    if (mapelData.length === 0) {
      return res.status(404).json({ message: 'Mapel tidak ditemukan' });
    }

    // Mengembalikan data mentah objek pertama dari SP
    // SP admin_read_mapel mengembalikan: m.mapel_id, m.nama_mapel, m.kkm, m.created_at
    res.status(200).json(mapelData[0]);
  } catch (error) {
    console.error('Error in getMapelById:', error);
    res.status(500).json({ message: 'Gagal mengambil data mapel', error: error.message });
  }
};

// UPDATE - Edit Mapel (menggunakan SP admin_update_mapel)
const updateMapel = async (req, res) => {
  const { id } = req.params; // Mengambil mapel_id dari parameter URL
  const { nama_mapel, kkm } = req.body;

  // Validasi input dasar
  if (!id) {
    return res.status(400).json({ message: 'Parameter ID mapel wajib diisi.' });
  }
  if (!nama_mapel && (kkm === undefined || kkm === null)) { // Setidaknya satu field harus diisi untuk update
    return res.status(400).json({ message: 'Setidaknya satu field (nama_mapel atau kkm) harus diisi untuk update.' });
  }
  if (nama_mapel && typeof nama_mapel !== 'string') {
    return res.status(400).json({ message: 'Tipe data nama_mapel harus string.' });
  }
  if (kkm !== undefined && kkm !== null && typeof kkm !== 'number') {
    return res.status(400).json({ message: 'Tipe data kkm harus angka.' });
  }
  // Contoh penggunaan helper SQL Injection (opsional)
  if (nama_mapel && containsSQLInjection(nama_mapel)) {
      return res.status(400).json({ message: 'Input nama_mapel mengandung kata terlarang.' });
  }

  try {
    // 1. Cek apakah mapel ada (opsional, karena SP update mungkin tidak error jika ID tidak ada, tergantung implementasi COALESCE)
    // Untuk memberikan feedback yang lebih baik, kita bisa cek dulu.
    const [mapelExistResult] = await db.query('CALL admin_read_mapel(?)', [id]);
    if (mapelExistResult[0].length === 0) {
      return res.status(404).json({ message: 'Mapel tidak ditemukan, tidak dapat memperbarui.' });
    }
    
    // Panggil stored procedure admin_update_mapel
    // SP menggunakan COALESCE, jadi jika nama_mapel atau kkm adalah NULL/undefined di req.body,
    // nilai lama akan dipertahankan. Kirim null jika field tidak ada di req.body.
    await db.query(
      'CALL admin_update_mapel(?, ?, ?)',
      [
        id,
        nama_mapel !== undefined ? nama_mapel : null,
        kkm !== undefined ? kkm : null
      ]
    );

    res.status(200).json({ message: 'Mapel berhasil diperbarui' });
  } catch (error) {
    console.error('Error in updateMapel:', error);
    res.status(500).json({ message: 'Gagal memperbarui mapel', error: error.message });
  }
};

// DELETE - Hapus Mapel (menggunakan SP admin_delete_mapel)
const deleteMapel = async (req, res) => {
  const { id } = req.params; // Mengambil mapel_id dari parameter URL

  if (!id) {
    return res.status(400).json({ message: 'Parameter ID mapel wajib diisi.' });
  }

  try {
    // Opsional: Cek dulu apakah mapel ada sebelum mencoba menghapus
    const [mapelExistResult] = await db.query('CALL admin_read_mapel(?)', [id]);
    if (mapelExistResult[0].length === 0) {
      return res.status(404).json({ message: 'Mapel tidak ditemukan, tidak ada yang dihapus.' });
    }

    // Panggil stored procedure admin_delete_mapel
    await db.query('CALL admin_delete_mapel(?)', [id]);
    
    res.status(200).json({ message: 'Mapel berhasil dihapus' });
  } catch (error) {
    console.error('Error in deleteMapel:', error);
    // Tambahan: Cek apakah error disebabkan oleh foreign key constraint
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || (error.sqlMessage && error.sqlMessage.toLowerCase().includes('foreign key constraint fails'))) {
        return res.status(400).json({ message: 'Gagal menghapus mapel karena masih direferensikan oleh data lain (misalnya jadwal atau krs).', error: error.message });
    }
    res.status(500).json({ message: 'Gagal menghapus mapel', error: error.message });
  }
};

module.exports = {
  getAllMapel,
  getMapelById,
  createMapel,
  updateMapel,
  deleteMapel,
};
