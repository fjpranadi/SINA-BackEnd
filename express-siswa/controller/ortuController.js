const db = require('../database/db');

exports.addOrtu = async (req, res) => {
  const {
    user_username,
    user_email,
    user_password,
    ortu_nik,
    ortu_nama,
    ortu_imei,
    ortu_alamat,
    ortu_status,
    ortu_pekerjaan,
    ortu_tempat_lahir,
    ortu_tanggal_lahir
  } = req.body;

  try {
    const [result] = await db.query(
      'CALL ortu_add(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        user_username,
        user_email,
        user_password,
        ortu_nik,
        ortu_nama,
        ortu_imei,
        ortu_alamat,
        ortu_status,
        ortu_pekerjaan,
        ortu_tempat_lahir,
        ortu_tanggal_lahir
      ]
    );
    res.status(200).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrtu = async (req, res) => {
  const { nik, user_id, keyword, status } = req.query;

  try {
    const [result] = await db.query(
      'CALL ortu_get(?, ?, ?, ?)',
      [
        nik || null,
        user_id || null,
        keyword || null,
        status || null
      ]
    );
    res.status(200).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrtu = async (req, res) => {
const { nik } = req.params;
  const {
    nama_ortu,
    imei,
    alamat,
    status_ortu,
    pekerjaan,
    tempat_lahir,
    tanggal_lahir
  } = req.body;

  try {
    const [result] = await db.query(
      'CALL ortu_update(?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nik,
        nama_ortu,
        imei,
        alamat,
        status_ortu,
        pekerjaan,
        tempat_lahir,
        tanggal_lahir
      ]
    );
    res.status(200).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


