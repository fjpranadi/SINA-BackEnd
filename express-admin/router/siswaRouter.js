const express = require('express');
const router = express.Router();

const {
  tambahSiswa,
  getAllSiswa,
  getSiswaByUserId,
  updateSiswa,
  hapusSiswa
} = require('../controller/siswaController');

const { verifyToken } = require('../controller/authController');

// Middleware untuk cek role admin
const onlyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
};

// Lindungi semua route
router.use(verifyToken, onlyAdmin);

// Route siswa
router.post('/admin/siswa', tambahSiswa);                      // Tambah siswa
router.get('/admin/siswa', getAllSiswa);                       // Ambil semua siswa
router.get('/admin/siswa/:user_id', getSiswaByUserId);         // Ambil 1 siswa by user_id
router.put('/admin/siswa/:user_id', updateSiswa);              // Update siswa
router.delete('/admin/siswa/:user_id', hapusSiswa);            // Hapus siswa

module.exports = router;
