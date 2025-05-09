const db = require('../database/db');

// GET semua mapel
const getAllMapel = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM mapel');
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data mapel', error });
    }
};

// GET mapel by ID
const getMapelById = async (req, res) => {
    const id = req.params.id;
    try {
        const [rows] = await db.query('SELECT * FROM mapel WHERE mapel_id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Mapel tidak ditemukan' });
        res.status(200).json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil data mapel', error });
    }
};

// CREATE mapel
const createMapel = async (req, res) => {
    const { nama_mapel, km } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO mapel (nama_mapel, kkm) VALUES (?, ?)',
            [nama_mapel, km]
        );
        res.status(201).json({ message: 'Mapel berhasil ditambahkan', mapel_id: result.insertId });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menambahkan mapel', error });
    }
};

// UPDATE mapel
const updateMapel = async (req, res) => {
    const id = req.params.id;
    const { nama_mapel, km } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE mapel SET nama_mapel = ?, kkm = ? WHERE mapel_id = ?',
            [nama_mapel, km, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Mapel tidak ditemukan' });
        res.status(200).json({ message: 'Mapel berhasil diperbarui' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memperbarui mapel', error });
    }
};

// DELETE mapel
const deleteMapel = async (req, res) => {
    const id = req.params.id;
    try {
        const [result] = await db.query('DELETE FROM mapel WHERE mapel_id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Mapel tidak ditemukan' });
        res.status(200).json({ message: 'Mapel berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal menghapus mapel', error });
    }
};

module.exports = {
    getAllMapel,
    getMapelById,
    createMapel,
    updateMapel,
    deleteMapel,
};
