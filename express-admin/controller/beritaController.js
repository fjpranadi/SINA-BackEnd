// Import database connection
const db = require('../database/db');
// Import uuid to generate IDs if not provided for new records
const { v4: uuidv4 } = require('uuid');

// GET semua berita (menggunakan SP sp_get_all_berita)
const getAllberita = async (req, res) => {
    try {
        // Panggil stored procedure sp_get_all_berita
        // Hasil dari SP ada di elemen pertama array yang dikembalikan oleh query
        const [rows] = await db.query('CALL sp_get_all_berita()');
        const beritaData = rows[0]; // rows[0] berisi array objek berita

        // Ambil username dari JWT (sesuai logika kode asli Anda)
        // Pastikan req.user dan req.user.username tersedia dari middleware otentikasi Anda
        const username = req.user ? req.user.username : 'UsernameTidakTersedia';

        // Tambahkan username ke setiap item berita
        const beritaWithUsername = beritaData.map((berita) => ({
            ...berita,
            username, // Menambahkan field username
        }));

        res.status(200).json(beritaWithUsername);
    } catch (error) {
        console.error('Error in getAllberita:', error);
        res.status(500).json({ message: 'Gagal mengambil data berita', error: error.message });
    }
};

// GET berita by ID (menggunakan SP sp_get_berita_by_id)
const getberitalById = async (req, res) => {
    const id = req.params.id;
    try {
        // Panggil stored procedure sp_get_berita_by_id
        const [rows] = await db.query('CALL sp_get_berita_by_id(?)', [id]);
        // Hasil SP ada di rows[0], yang merupakan array. Jika ditemukan, akan ada 1 elemen.
        if (rows[0].length === 0) {
            return res.status(404).json({ message: 'Berita tidak ditemukan' });
        }
        res.status(200).json(rows[0][0]); // Ambil objek berita pertama
    } catch (error) {
        console.error('Error in getberitalById:', error);
        res.status(500).json({ message: 'Gagal mengambil data berita', error: error.message });
    }
};

// CREATE berita (menggunakan SP sp_create_berita)
const createberita = async (req, res) => {
    // Ambil data dari request body dan file
    const {
        guru_nip, // Bisa null jika tidak diisi
        judul,    // Bisa null jika tidak diisi
        isi,      // Bisa null jika tidak diisi
        tipe      // Bisa null jika tidak diisi ('berita' atau 'pengumuman')
    } = req.body;

    const foto = req.file ? req.file.filename : null; // Nama file foto jika diupload
    const user_id = req.user ? req.user.userId : null; // Ambil userId dari JWT

    if (!user_id) {
        return res.status(401).json({ message: 'User tidak terautentikasi atau user ID tidak ditemukan.' });
    }
    
    // Generate berita_id baru menggunakan UUID
    const berita_id = uuidv4();

    try {
        // Ambil admin_id berdasarkan user_id (logika dari kode asli Anda)
        const [adminResult] = await db.query(
            'SELECT admin_id FROM admin WHERE user_id = ?',
            [user_id]
        );

        if (adminResult.length === 0) {
            return res.status(404).json({ message: 'Admin tidak ditemukan untuk user ini.' });
        }
        const admin_id = adminResult[0].admin_id;

        // Panggil stored procedure sp_create_berita
        // Perhatikan: SP Anda memiliki 'P_guru_nip' (huruf besar P). Jika ini typo di SP dan seharusnya 'p_guru_nip',
        // maka tidak masalah. Jika memang 'P_guru_nip' di DB, MySQL case sensitivity bisa berpengaruh tergantung konfigurasi.
        // Saya akan menggunakan parameter sesuai definisi SP yang Anda berikan.
        await db.query(
            'CALL sp_create_berita(?, ?, ?, ?, ?, ?, ?)',
            [berita_id, admin_id, guru_nip, judul, foto, isi, tipe]
        );

        res.status(201).json({ message: 'Berita berhasil ditambahkan', berita_id: berita_id });
    } catch (error) {
        console.error('Error in createberita:', error);
        // Cek jika error karena tipe enum tidak valid
        if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' && error.sqlMessage && error.sqlMessage.includes("column 'tipe'")) {
             return res.status(400).json({ message: "Nilai untuk 'tipe' tidak valid. Harus 'berita' atau 'pengumuman'.", error: error.message });
        }
        res.status(500).json({ message: 'Gagal menambahkan berita', error: error.message });
    }
};

// EDIT berita (menggunakan SP sp_update_berita)
const editberita = async (req, res) => {
    const beritaIdToUpdate = req.params.id; // ID berita yang akan diupdate
    
    // Ambil data dari request body dan file
    const {
        // admin_id tidak diupdate melalui endpoint ini, SP akan menggunakan COALESCE
        guru_nip, // Jika undefined, akan di-pass sebagai null ke SP
        judul,    // Jika undefined, akan di-pass sebagai null ke SP
        isi,      // Jika undefined, akan di-pass sebagai null ke SP
        tipe      // Jika undefined, akan di-pass sebagai null ke SP ('berita' atau 'pengumuman')
    } = req.body;

    const newFoto = req.file ? req.file.filename : null; // Nama file foto baru jika diupload, null jika tidak

    try {
        // 1. Cek apakah berita dengan ID tersebut ada menggunakan SP
        const [existingRows] = await db.query('CALL sp_get_berita_by_id(?)', [beritaIdToUpdate]);
        if (existingRows[0].length === 0) {
            return res.status(404).json({ message: 'Berita tidak ditemukan, tidak dapat memperbarui.' });
        }
        
        // admin_id tidak diubah oleh fungsi ini, jadi kita pass null ke SP
        // agar COALESCE di SP mempertahankan admin_id yang lama.
        const p_admin_id_for_sp = null; 

        // Panggil stored procedure sp_update_berita
        // SP menggunakan COALESCE, jadi kita bisa pass null untuk field yang tidak ingin diubah
        // atau jika nilai dari req.body adalah undefined.
        await db.query(
            'CALL sp_update_berita(?, ?, ?, ?, ?, ?, ?)',
            [
                beritaIdToUpdate,
                p_admin_id_for_sp, // admin_id tidak diubah dari sini
                guru_nip !== undefined ? guru_nip : null,
                judul !== undefined ? judul : null,
                newFoto, // Jika null, SP akan COALESCE ke foto lama
                isi !== undefined ? isi : null,
                tipe !== undefined ? tipe : null
            ]
        );

        res.status(200).json({ message: 'Berita berhasil diperbarui' });
    } catch (error) {
        console.error('Error in editberita:', error);
         // Cek jika error karena tipe enum tidak valid
        if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' && error.sqlMessage && error.sqlMessage.includes("column 'tipe'")) {
             return res.status(400).json({ message: "Nilai untuk 'tipe' tidak valid saat update. Harus 'berita' atau 'pengumuman'.", error: error.message });
        }
        res.status(500).json({ message: 'Gagal memperbarui berita', error: error.message });
    }
};

// DELETE berita (menggunakan SP sp_delete_berita)
const deleteberita = async (req, res) => {
    const id = req.params.id;
    try {
        // Opsional: Cek dulu apakah berita ada sebelum mencoba menghapus
        const [existingRows] = await db.query('CALL sp_get_berita_by_id(?)', [id]);
        if (existingRows[0].length === 0) {
            return res.status(404).json({ message: 'Berita tidak ditemukan, tidak ada yang dihapus.' });
        }

        // Panggil stored procedure sp_delete_berita
        await db.query('CALL sp_delete_berita(?)', [id]);
        
        res.status(200).json({ message: 'Berita berhasil dihapus' });
    } catch (error) {
        console.error('Error in deleteberita:', error);
        res.status(500).json({ message: 'Gagal menghapus berita', error: error.message });
    }
};

module.exports = {
    createberita,
    deleteberita,
    getAllberita,
    getberitalById,
    editberita
};
