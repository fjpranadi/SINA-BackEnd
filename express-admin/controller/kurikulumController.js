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
    const MAX_ATTEMPTS = 5; // Maximum attempts to generate unique ID
    
    try {
        let attempts = 0;
        let kurikulum_id;
        let result;
        
        while (attempts < MAX_ATTEMPTS) {
            // Generate random ID (64-bit integer)
            kurikulum_id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            
            try {
                [result] = await db.query(
                    'INSERT INTO kurikulum (kurikulum_id, nama_kurikulum, deskripsi) VALUES (?, ?, ?)',
                    [kurikulum_id, nama_kurikulum, deskripsi]
                );
                break; // Success - exit the loop
            } catch (error) {
                if (error.code !== 'ER_DUP_ENTRY') {
                    throw error; // Re-throw if it's not a duplicate ID error
                }
                attempts++;
                if (attempts >= MAX_ATTEMPTS) {
                    throw new Error('Gagal menghasilkan ID unik setelah beberapa percobaan');
                }
            }
        }
        
        res.status(201).json({ 
            message: 'Kurikulum berhasil ditambahkan', 
            kurikulum_id: kurikulum_id 
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Gagal menambahkan kurikulum', 
            error: error.message 
        });
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
