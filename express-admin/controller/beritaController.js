const db = require('../database/db');


const getAllberita = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM berita');
        res.status(200).json(rows);
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
    const {guru_nip, judul, isi, tipe } = req.body;
    const foto = req.file ? req.file.filename : null;
    const admin_id = req.user.userId;
    try {
        const [result] = await db.query(
            'INSERT INTO berita (admin_id, guru_nip, judul, isi, foto, tipe) VALUES (?, ?, ?, ?, ?, ?)',
            [admin_id, guru_nip, judul, isi, foto, tipe]
        );
        res.status(201).json({ message: 'Berita berhasil ditambahkan', berita_id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambahkan berita', error });
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
    getberitalById
};
