const db = require('../database/db'); 

// CREATE
const createKurikulum = async (req, res) => {
  const { nama_kurikulum, deskripsi } = req.body;

  if (!nama_kurikulum || !deskripsi) {
    return res.status(400).json({ message: 'Nama kurikulum dan deskripsi wajib diisi.' });
  }

  try {
    const [result] = await db.query('CALL create_kurikulum(?, ?)', [nama_kurikulum, deskripsi]);
    const pesan = result[0][0]?.pesan || 'Kurikulum berhasil ditambahkan.';
    res.status(201).json({ message: pesan });
  } catch (err) {
    console.error('Error saat menambahkan kurikulum:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat menambahkan kurikulum.' });
  }
};

// READ
const readKurikulum = async (req, res) => {
  try {
    const [result] = await db.query('CALL read_kurikulum()');
    const data = result[0];
    res.status(200).json({ data });
  } catch (err) {
    console.error('Error saat mengambil data kurikulum:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat mengambil data kurikulum.' });
  }
};

// UPDATE
const updateKurikulum = async (req, res) => {
  const { id } = req.params;
  const { nama_kurikulum, deskripsi } = req.body;

  if (!nama_kurikulum || !deskripsi) {
    return res.status(400).json({ message: 'Nama kurikulum dan deskripsi wajib diisi.' });
  }

  try {
    const [result] = await db.query('CALL update_kurikulum(?, ?, ?)', [
      parseInt(id),
      nama_kurikulum,
      deskripsi,
    ]);

    const pesan = result[0][0]?.pesan || 'Operasi tidak menghasilkan pesan.';
    res.status(200).json({ message: pesan });
  } catch (err) {
    console.error('Error saat memperbarui kurikulum:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat memperbarui kurikulum.' });
  }
};

// DELETE
const deleteKurikulum = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('CALL delete_kurikulum(?)', [parseInt(id)]);
    const pesan = result[0][0]?.pesan || 'Operasi tidak menghasilkan pesan.';
    res.status(200).json({ message: pesan });
  } catch (err) {
    console.error('Error saat menghapus kurikulum:', err);
    res.status(500).json({ message: 'Terjadi kesalahan saat menghapus kurikulum.' });
  }
};


module.exports = {
  createKurikulum,
  readKurikulum,
  updateKurikulum,
  deleteKurikulum,
};
