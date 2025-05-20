const db = require('../database/db');


const getAllberita = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM berita');
        const username = req.user.username; // ambil dari JWT

        // Tambahkan username ke setiap berita
        const beritaWithUsername = rows.map((berita) => ({
            ...berita,
            username,
        }));

        res.status(200).json(beritaWithUsername);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data berita', error });
    }
};



const getberitalById = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query('SELECT * FROM berita WHERE berita_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'berita tidak ditemukan' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data berita', error });
    }
};


const createberita = async (req, res) => {
    const {
        guru_nip,
        judul = null,
        isi = null,
        tipe = null
    } = req.body;

    const foto = req.file ? req.file.filename : null;
    const user_id = req.user.userId;

    try {
        // Ambil admin_id berdasarkan user_id
        const [adminResult] = await db.query(
            'SELECT admin_id FROM admin WHERE user_id = ?',
            [user_id]
        );

        if (adminResult.length === 0) {
            return res.status(404).json({ message: 'Admin tidak ditemukan untuk user ini' });
        }

        const admin_id = adminResult[0].admin_id;

        const [result] = await db.query(
            'INSERT INTO berita (admin_id, guru_nip, judul, isi, foto, tipe) VALUES (?, ?, ?, ?, ?, ?)',
            [admin_id, guru_nip, judul, isi, foto, tipe]
        );

        res.status(201).json({ message: 'Berita berhasil ditambahkan', berita_id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambahkan berita', error });
    }
};

const editberita = async (req, res) => {
    const id = req.params.id;
    const {
        guru_nip,
        judul,
        isi,
        tipe
    } = req.body;

    const foto = req.file ? req.file.filename : null;

    try {
        // Cek apakah berita dengan ID tersebut ada
        const [existingRows] = await db.query('SELECT * FROM berita WHERE berita_id = ?', [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ message: 'Berita tidak ditemukan' });
        }

        const existing = existingRows[0];

        // Gunakan data lama jika input baru tidak ada
        const updatedGuruNip = guru_nip !== undefined ? guru_nip : existing.guru_nip;
        const updatedJudul = judul !== undefined ? judul : existing.judul;
        const updatedIsi = isi !== undefined ? isi : existing.isi;
        const updatedFoto = foto !== null ? foto : existing.foto;
        const updatedTipe = tipe !== undefined ? tipe : existing.tipe;

        // Update berita
        await db.query(
            'UPDATE berita SET guru_nip = ?, judul = ?, isi = ?, foto = ?, tipe = ? WHERE berita_id = ?',
            [updatedGuruNip, updatedJudul, updatedIsi, updatedFoto, updatedTipe, id]
        );

        res.status(200).json({ message: 'Berita berhasil diperbarui' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui berita', error });
    }
};

const deleteberita = async (req, res) => {
    const id = req.params.id;
    try {
        const [result] = await db.query('DELETE FROM berita WHERE berita_id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'berita tidak ditemukan' });
        res.status(200).json({ message: 'Berita berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus berita', error });
    }
};

module.exports = {
    createberita,
    deleteberita,
    getAllberita,
    getberitalById,
    editberita
};
