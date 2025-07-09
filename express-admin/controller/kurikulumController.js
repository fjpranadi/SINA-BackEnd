const db = require('../database/db');

// GET semua kurikulum dengan tingkat dari kurikulum_detail
const getAllkurikulum = async (req, res) => {
    try {
        // Query untuk mendapatkan semua kurikulum
        const [kurikulumRows] = await db.query('SELECT * FROM kurikulum');
        
        // Jika tidak ada data kurikulum
        if (kurikulumRows.length === 0) {
            return res.status(200).json([]);
        }

        // Untuk setiap kurikulum, dapatkan tingkat dari kurikulum_detail
        const kurikulumWithTingkat = await Promise.all(
            kurikulumRows.map(async (kurikulum) => {
                // Ambil satu contoh tingkat dari kurikulum_detail untuk kurikulum ini
                const [detailRows] = await db.query(
                    'SELECT DISTINCT tingkat FROM kurikulum_detail WHERE kurikulum_id = ? LIMIT 1',
                    [kurikulum.kurikulum_id]
                );

                // Tambahkan properti tingkat ke objek kurikulum
                return {
                    ...kurikulum,
                    tingkat: detailRows.length > 0 ? detailRows[0].tingkat : null
                };
            })
        );

        res.status(200).json(kurikulumWithTingkat);
    } catch (error) {
        console.error('Error fetching kurikulum:', error);
        res.status(500).json({ 
            message: 'Gagal mengambil data kurikulum', 
            error: error.message 
        });
    }
};

// GET mapel by ID
// GET kurikulum by ID with mapel details
const getkurikulumlById = async (req, res) => {
    const id = req.params.id;
    try {
        // Get kurikulum data
        const [kurikulumRows] = await db.query('SELECT * FROM kurikulum WHERE kurikulum_id = ?', [id]);
        if (kurikulumRows.length === 0) return res.status(404).json({ message: 'Kurikulum tidak ditemukan' });

        // Get mapel details for this kurikulum
        const [mapelRows] = await db.query(`
            SELECT kd.mapel_id, m.nama_mapel, kd.tingkat, kd.kkm
            FROM kurikulum_detail kd
            JOIN mapel m ON kd.mapel_id = m.mapel_id
            WHERE kd.kurikulum_id = ?
        `, [id]);

        // Determine tingkat value (take the first one found)
        const tingkat = mapelRows.length > 0 ? mapelRows[0].tingkat : null;

        // Combine the results
        const response = {
            ...kurikulumRows[0],
            tingkat: tingkat,  // Add tingkat here outside mapel_list
            mapel_list: mapelRows
        };

        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ 
            message: 'Gagal mengambil data kurikulum', 
            error: error.message 
        });
    }
};

// CREATE mapel
const createKurikulum = async (req, res) => {
    const { nama_kurikulum, deskripsi, tingkat, jenjang, mapel_list } = req.body;
    const MAX_ATTEMPTS = 5;
    
    // Validate jenjang if provided
    if (jenjang) {
        const validJenjang = ['sd', 'smp', 'sma'];
        if (!validJenjang.includes(jenjang)) {
            return res.status(400).json({ message: 'Jenjang harus SD, SMP, atau SMA' });
        }
    }

    try {
        // Validate mapel_list if provided
        if (mapel_list && mapel_list.length > 0) {
            // Check if all mapel_ids exist
            const mapelIds = mapel_list.map(item => item.mapel_id);
            const [existingMapel] = await db.query('SELECT mapel_id FROM mapel WHERE mapel_id IN (?)', [mapelIds]);
            
            if (existingMapel.length !== mapelIds.length) {
                return res.status(400).json({ message: 'Beberapa mapel_id tidak valid' });
            }
        }

        let attempts = 0;
        let kurikulum_id;
        let result;
        
        while (attempts < MAX_ATTEMPTS) {
            kurikulum_id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
            
            try {
                // Start transaction
                await db.query('START TRANSACTION');
                
                // Insert into kurikulum table (without tingkat)
                [result] = await db.query(
                    'INSERT INTO kurikulum (kurikulum_id, nama_kurikulum, deskripsi, jenjang) VALUES (?, ?, ?, ?)',
                    [kurikulum_id, nama_kurikulum, deskripsi, jenjang || null]
                );
                
                // If mapel_list provided, insert into kurikulum_detail
                if (mapel_list && mapel_list.length > 0) {
                    // Get KKM values for each mapel
                    const [mapelData] = await db.query(
                        'SELECT mapel_id, kkm FROM mapel WHERE mapel_id IN (?)',
                        [mapel_list.map(item => item.mapel_id)]
                    );
                    
                    const kkmMap = {};
                    mapelData.forEach(item => {
                        kkmMap[item.mapel_id] = item.kkm;
                    });
                    
                    // Prepare values for batch insert
                    const detailValues = mapel_list.map(item => [
                        Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(), // random kd_id
                        kurikulum_id,
                        item.mapel_id,
                        tingkat || null, // Use the provided tingkat for all mapel
                        kkmMap[item.mapel_id] || 75, // default KKM if not found
                        new Date() // created_at
                    ]);
                    
                    // Batch insert into kurikulum_detail
                    await db.query(
                        'INSERT INTO kurikulum_detail (kd_id, kurikulum_id, mapel_id, tingkat, kkm, created_at) VALUES ?',
                        [detailValues]
                    );
                }
                
                // Commit transaction
                await db.query('COMMIT');
                break; // Success - exit the loop
            } catch (error) {
                // Rollback transaction if any error occurs
                await db.query('ROLLBACK');
                
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
            data: {
                kurikulum_id,
                nama_kurikulum,
                deskripsi,
                jenjang,
                tingkat, // Return the tingkat that was applied to all mapel
                total_mapel: mapel_list ? mapel_list.length : 0
            }
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Gagal menambahkan kurikulum', 
            error: error.message 
        });
    }
};

// UPDATE kurikulum with complete functionality
const updateKurikulum = async (req, res) => {
    const id = req.params.id;
    const { nama_kurikulum, deskripsi, tingkat, jenjang, mapel_list } = req.body;
    
    try {
        // Start transaction
        await db.query('START TRANSACTION');

        // 1. Get current kurikulum data
        const [currentKurikulum] = await db.query('SELECT * FROM kurikulum WHERE kurikulum_id = ?', [id]);
        if (currentKurikulum.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Kurikulum tidak ditemukan' });
        }

        // 2. Update kurikulum main data (only if provided)
        const updateData = {
            nama_kurikulum: nama_kurikulum || currentKurikulum[0].nama_kurikulum,
            deskripsi: deskripsi || currentKurikulum[0].deskripsi,
            jenjang: jenjang || currentKurikulum[0].jenjang
        };

        const [updateResult] = await db.query(
            'UPDATE kurikulum SET nama_kurikulum = ?, deskripsi = ?, jenjang = ? WHERE kurikulum_id = ?',
            [updateData.nama_kurikulum, updateData.deskripsi, updateData.jenjang, id]
        );

        // 3. Handle mapel_list updates if provided
        if (mapel_list) {
            // Delete existing mapel associations
            await db.query('DELETE FROM kurikulum_detail WHERE kurikulum_id = ?', [id]);

            if (mapel_list.length > 0) {
                // Validate mapel_ids
                const mapelIds = mapel_list.map(item => item.mapel_id);
                const [existingMapel] = await db.query('SELECT mapel_id FROM mapel WHERE mapel_id IN (?)', [mapelIds]);
                
                if (existingMapel.length !== mapelIds.length) {
                    await db.query('ROLLBACK');
                    return res.status(400).json({ message: 'Beberapa mapel_id tidak valid' });
                }

                // Get KKM values for each mapel
                const [mapelData] = await db.query(
                    'SELECT mapel_id, kkm FROM mapel WHERE mapel_id IN (?)',
                    [mapel_list.map(item => item.mapel_id)]
                );
                
                const kkmMap = {};
                mapelData.forEach(item => {
                    kkmMap[item.mapel_id] = item.kkm;
                });
                
                // Prepare values for batch insert
                const detailValues = mapel_list.map(item => [
                    Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(), // random kd_id
                    id,
                    item.mapel_id,
                    tingkat || null, // Use the provided tingkat or null
                    kkmMap[item.mapel_id] || 75, // default KKM if not found
                    new Date() // created_at
                ]);
                
                // Batch insert new mapel associations
                await db.query(
                    'INSERT INTO kurikulum_detail (kd_id, kurikulum_id, mapel_id, tingkat, kkm, created_at) VALUES ?',
                    [detailValues]
                );
            }
        }

        // Check if any data was actually changed
        const [updatedKurikulum] = await db.query('SELECT * FROM kurikulum WHERE kurikulum_id = ?', [id]);
        let dataChanged = false;

        // Check kurikulum table changes
        if (updateData.nama_kurikulum !== currentKurikulum[0].nama_kurikulum ||
            updateData.deskripsi !== currentKurikulum[0].deskripsi ||
            updateData.jenjang !== currentKurikulum[0].jenjang) {
            dataChanged = true;
        }

        // Check mapel_list changes if provided
        if (mapel_list) {
            const [currentMapel] = await db.query('SELECT COUNT(*) as count FROM kurikulum_detail WHERE kurikulum_id = ?', [id]);
            if (mapel_list.length !== currentMapel[0].count) {
                dataChanged = true;
            }
        }

        await db.query('COMMIT');

        if (!dataChanged) {
            return res.status(200).json({ 
                message: 'Tidak ada data yang diubah',
                data: {
                    ...updatedKurikulum[0],
                    tingkat: tingkat || null
                }
            });
        }

        res.status(200).json({ 
            message: 'Kurikulum berhasil diperbarui',
            data: {
                ...updatedKurikulum[0],
                tingkat: tingkat || null
            }
        });

    } catch (error) {
        await db.query('ROLLBACK');
        res.status(500).json({ 
            message: 'Gagal memperbarui kurikulum', 
            error: error.message 
        });
    }
};

// DELETE mapel
// DELETE kurikulum with all its associations
const deleteKurikulum = async (req, res) => {
    const id = req.params.id;
    
    try {
        // Start transaction
        await db.query('START TRANSACTION');

        // 1. Check if kurikulum exists
        const [kurikulum] = await db.query('SELECT * FROM kurikulum WHERE kurikulum_id = ?', [id]);
        if (kurikulum.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ message: 'Kurikulum tidak ditemukan' });
        }

        // 2. Delete all mapel associations first (to maintain referential integrity)
        await db.query('DELETE FROM kurikulum_detail WHERE kurikulum_id = ?', [id]);

        // 3. Delete the kurikulum
        const [result] = await db.query('DELETE FROM kurikulum WHERE kurikulum_id = ?', [id]);

        // Commit transaction
        await db.query('COMMIT');

        res.status(200).json({ 
            message: 'Kurikulum berhasil dihapus beserta semua mapel yang terkait',
            data: {
                kurikulum_id: id,
                nama_kurikulum: kurikulum[0].nama_kurikulum,
                total_mapel_deleted: result.affectedRows
            }
        });

    } catch (error) {
        // Rollback transaction if any error occurs
        await db.query('ROLLBACK');
        
        res.status(500).json({ 
            message: 'Gagal menghapus kurikulum', 
            error: error.message 
        });
    }
};

const getMapelByTahunAkademik = async (req, res) => {
    const { kelas_id } = req.params;

    try {
        // 1. Get kelas data including tahun_akademik_id and kurikulum_id
        const [kelasData] = await db.query(`
            SELECT k.kurikulum_id, k.tahun_akademik_id, k.jenjang, k.tingkat 
            FROM kelas k 
            WHERE k.kelas_id = ?
        `, [kelas_id]);

        if (kelasData.length === 0) {
            return res.status(404).json({ message: 'Kelas tidak ditemukan' });
        }

        const { kurikulum_id, tahun_akademik_id, jenjang, tingkat } = kelasData[0];

        // 2. Verify tahun akademik is active
        const [tahunAkademik] = await db.query(`
            SELECT status 
            FROM tahun_akademik 
            WHERE tahun_akademik_id = ? AND kurikulum_id = ?
        `, [tahun_akademik_id, kurikulum_id]);

        if (tahunAkademik.length === 0) {
            return res.status(404).json({ message: 'Tahun akademik tidak ditemukan untuk kurikulum ini' });
        }

        if (tahunAkademik[0].status !== 'aktif') {
            return res.status(400).json({ message: 'Tahun akademik tidak aktif' });
        }

        // 3. Get all mapel for this kurikulum and tingkat
        const [mapelData] = await db.query(`
            SELECT m.mapel_id, m.nama_mapel, kd.kkm
            FROM kurikulum_detail kd
            JOIN mapel m ON kd.mapel_id = m.mapel_id
            WHERE kd.kurikulum_id = ? AND kd.tingkat = ?
            ORDER BY m.nama_mapel
        `, [kurikulum_id, tingkat]);

        res.status(200).json({
            message: 'Data mapel berhasil ditemukan',
            data: {
                kelas_id,
                tahun_akademik_id,
                kurikulum_id,
                jenjang,
                tingkat,
                mapel: mapelData
            }
        });

    } catch (error) {
        res.status(500).json({ 
            message: 'Gagal mengambil data mapel', 
            error: error.message 
        });
    }
};
module.exports = {
    createKurikulum,
    deleteKurikulum,
    getAllkurikulum,
    updateKurikulum,
    getkurikulumlById,
    getMapelByTahunAkademik   
};
