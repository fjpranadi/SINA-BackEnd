const db = require('../database/db');

// GET semua mapel
const getAllkurikulum = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM kurikulum');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data kurikulum', error });
    }
};

// GET mapel by ID
const getkurikulumlById = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query('SELECT * FROM kurikulum WHERE kurikulum_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'kurikulum tidak ditemukan' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data kurikulum', error });
    }
};

// CREATE mapel
const createKurikulum = async (req, res) => {
    const { nama_kurikulum, deskripsi } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO kurikulum (nama_kurikulum, deskripsi) VALUES (?, ?)',
            [nama_kurikulum, deskripsi]
        );
        res.status(201).json({ message: 'kurikulum berhasil ditambahkan', kurikulum_id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambahkan kurikulum', error });
    }
};

// UPDATE mapel
const updateKurikulum = async (req, res) => {
    const id = req.params.id;
    const { nama_kurikulum, deskripsi } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE kurikulum SET nama_kurikulum = ?, deskripsi = ? WHERE kurikulum_id = ?',
            [nama_kurikulum, deskripsi, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'kurikulum tidak ditemukan' });
        res.status(200).json({ message: 'kurikulum berhasil diperbarui' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui kurikulum', error });
    }
};

// DELETE mapel
const deleteKurikulum = async (req, res) => {
    const id = req.params.id;
    try {
        const [result] = await db.query('DELETE FROM kurikulum WHERE kurikulum_id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'kurikulum tidak ditemukan' });
        res.status(200).json({ message: 'kurikulum berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus kurikulum', error });
    }
};

module.exports = {
    createKurikulum,
    deleteKurikulum,
    getAllkurikulum,
    updateKurikulum,
    getkurikulumlById   
};
