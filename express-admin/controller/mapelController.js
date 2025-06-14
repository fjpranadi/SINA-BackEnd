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
    const { nama_mapel, kkm } = req.body;
    
    try {
        // Fungsi untuk generate BIGINT random yang unik
        const generateUniqueBigIntId = async () => {
            let isUnique = false;
            let newId;
            
            while (!isUnique) {
                // Generate 10-digit random number (BIGINT compatible)
                newId = BigInt(Math.floor(1e9 + Math.random() * 9e9)); // 1000000000 - 9999999999
                
                // Cek apakah ID sudah ada di database
                const [existing] = await db.query(
                    'SELECT mapel_id FROM mapel WHERE mapel_id = ?', 
                    [newId.toString()]
                );
                
                if (existing.length === 0) {
                    isUnique = true;
                }
            }
            
            return newId;
        };

        // Generate mapel_id yang unik
        const mapel_id = await generateUniqueBigIntId();

        // Insert ke tabel mapel dengan mapel_id yang digenerate
        const [result] = await db.query(
            'INSERT INTO mapel (mapel_id, nama_mapel, kkm) VALUES (?, ?, ?)',
            [mapel_id.toString(), nama_mapel, kkm]
        );

        res.status(201).json({ 
            message: 'Mapel berhasil ditambahkan', 
            mapel_id: mapel_id.toString() // Mengembalikan sebagai string untuk konsistensi
        });
    } catch (error) {
        console.error('Error creating mapel:', error);
        res.status(500).json({ 
            message: 'Gagal menambahkan mapel', 
            error: error.message 
        });
    }
};

// UPDATE mapel
const updateMapel = async (req, res) => {
    const id = req.params.id;
    const { nama_mapel, kkm } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE mapel SET nama_mapel = ?, kkm = ? WHERE mapel_id = ?',
            [nama_mapel, kkm, id]
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
