// Import database connection
const db = require('../database/db');
// Import uuid to generate IDs if not provided
const { v4: uuidv4 } = require('uuid');

// GET semua kurikulum (menggunakan SP admin_read_kurikulum dengan ID null)
const getAllkurikulum = async (req, res) => {
    try {
        // Panggil stored procedure admin_read_kurikulum dengan parameter null
        // Stored procedure mengembalikan array di dalam array, jadi kita ambil elemen pertama [0]
        const [rows] = await db.query('CALL admin_read_kurikulum(?)', [null]);
        // Hasil sebenarnya ada di rows[0]
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error in getAllkurikulum:', error);
        res.status(500).json({ message: 'Gagal mengambil data kurikulum', error: error.message });
    }
};

// GET kurikulum by ID (menggunakan SP admin_read_kurikulum dengan ID spesifik)
const getkurikulumlById = async (req, res) => {
    const id = req.params.id;
    try {
        // Panggil stored procedure admin_read_kurikulum dengan ID yang diberikan
        const [rows] = await db.query('CALL admin_read_kurikulum(?)', [id]);
        // Hasil sebenarnya ada di rows[0]
        if (rows[0].length === 0) {
            return res.status(404).json({ message: 'Kurikulum tidak ditemukan' });
        }
        res.status(200).json(rows[0][0]); // Ambil objek pertama dari array hasil
    } catch (error) {
        console.error('Error in getkurikulumlById:', error);
        res.status(500).json({ message: 'Gagal mengambil data kurikulum', error: error.message });
    }
};

// CREATE kurikulum (menggunakan SP admin_create_kurikulum)
const createKurikulum = async (req, res) => {
    // Ambil data dari request body
    let { kurikulum_id, nama_kurikulum, deskripsi } = req.body;

    // Jika kurikulum_id tidak disediakan, generate UUID
    if (!kurikulum_id) {
        kurikulum_id = uuidv4();
    }

    // Validasi dasar
    if (!nama_kurikulum || !deskripsi) {
        return res.status(400).json({ message: 'Nama kurikulum dan deskripsi harus diisi' });
    }

    try {
        // Panggil stored procedure admin_create_kurikulum
        // Stored procedure tidak mengembalikan result set untuk INSERT, jadi kita cek error saja
        await db.query(
            'CALL admin_create_kurikulum(?, ?, ?)',
            [kurikulum_id, nama_kurikulum, deskripsi]
        );
        res.status(201).json({ message: 'Kurikulum berhasil ditambahkan', kurikulum_id: kurikulum_id });
    } catch (error) {
        console.error('Error in createKurikulum:', error);
        // Periksa apakah error terkait dengan duplikasi entry (jika ada unique constraint pada nama_kurikulum atau kurikulum_id)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Gagal menambahkan kurikulum: ID atau nama kurikulum sudah ada.', error: error.message });
        }
        res.status(500).json({ message: 'Gagal menambahkan kurikulum', error: error.message });
    }
};

// UPDATE kurikulum (menggunakan SP admin_update_kurikulum)
const updateKurikulum = async (req, res) => {
    const id = req.params.id;
    const { nama_kurikulum, deskripsi } = req.body; // nama_kurikulum dan deskripsi bisa null/undefined

    // Validasi dasar: setidaknya satu field harus diupdate
    if (nama_kurikulum === undefined && deskripsi === undefined) {
        return res.status(400).json({ message: 'Tidak ada data untuk diperbarui. Harap sediakan nama_kurikulum atau deskripsi.' });
    }

    try {
        // Panggil stored procedure admin_update_kurikulum
        // Stored procedure ini tidak mengembalikan affectedRows secara langsung seperti query UPDATE biasa.
        // Kita perlu cara lain untuk memeriksa apakah update berhasil, misalnya dengan mengambil data setelah update
        // atau mengandalkan SP untuk error jika ID tidak ditemukan (meskipun SP ini tidak melakukannya).
        // Untuk kesederhanaan, kita asumsikan SP berjalan tanpa error jika ID ada.
        // Namun, lebih baik jika SP mengembalikan status atau affectedRows.
        const [result] = await db.query(
            'CALL admin_update_kurikulum(?, ?, ?)',
            [id, nama_kurikulum, deskripsi]
        );

        // Karena SP tidak mengembalikan affectedRows, kita perlu cara lain untuk memastikan record ada.
        // Salah satu cara adalah dengan melakukan SELECT setelah UPDATE, atau SP bisa dimodifikasi untuk return status.
        // Untuk saat ini, kita akan asumsikan jika tidak ada error, update berhasil.
        // Namun, untuk kasus ID tidak ditemukan, SP admin_update_kurikulum tidak memberi error, hanya tidak melakukan apa-apa.
        // Idealnya, SP harus dimodifikasi untuk menangani kasus ID tidak ditemukan, atau kita lakukan pengecekan sebelum memanggil SP.

        // Pengecekan sederhana apakah kurikulum ada setelah mencoba update
        const [checkRows] = await db.query('CALL admin_read_kurikulum(?)', [id]);
        if (checkRows[0].length === 0) {
             return res.status(404).json({ message: 'Kurikulum tidak ditemukan setelah mencoba update (kemungkinan ID salah)' });
        }
        // Jika nama_kurikulum atau deskripsi yang diupdate sama dengan yang ada di DB,
        // SP mungkin tidak mengembalikan status perubahan. Kita anggap berhasil jika tidak ada error.
        res.status(200).json({ message: 'Kurikulum berhasil diperbarui' });

    } catch (error) {
        console.error('Error in updateKurikulum:', error);
        res.status(500).json({ message: 'Gagal memperbarui kurikulum', error: error.message });
    }
};

// DELETE kurikulum (menggunakan SP admin_delete_kurikulum)
const deleteKurikulum = async (req, res) => {
    const id = req.params.id;
    try {
        // Panggil stored procedure admin_delete_kurikulum
        // Sama seperti UPDATE, kita perlu cara untuk memastikan record benar-benar dihapus.
        // SP admin_delete_kurikulum tidak mengembalikan affectedRows.
        // Pertama, kita cek apakah kurikulum ada
        const [checkRowsBeforeDelete] = await db.query('CALL admin_read_kurikulum(?)', [id]);
        if (checkRowsBeforeDelete[0].length === 0) {
            return res.status(404).json({ message: 'Kurikulum tidak ditemukan, tidak ada yang dihapus' });
        }

        await db.query('CALL admin_delete_kurikulum(?)', [id]);
        
        // Verifikasi penghapusan (opsional, tapi baik untuk konfirmasi)
        const [checkRowsAfterDelete] = await db.query('CALL admin_read_kurikulum(?)', [id]);
        if (checkRowsAfterDelete[0].length > 0) {
            // Ini seharusnya tidak terjadi jika delete berhasil dan ID unik
            console.error('Error in deleteKurikulum: Record masih ada setelah operasi delete.');
            return res.status(500).json({ message: 'Gagal menghapus kurikulum: Record masih ada setelah proses.' });
        }

        res.status(200).json({ message: 'Kurikulum berhasil dihapus' });
    } catch (error) {
        console.error('Error in deleteKurikulum:', error);
        res.status(500).json({ message: 'Gagal menghapus kurikulum', error: error.message });
    }
};

module.exports = {
    createKurikulum,
    deleteKurikulum,
    getAllkurikulum,
    updateKurikulum,
    getkurikulumlById
};
