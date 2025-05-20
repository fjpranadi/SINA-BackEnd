const express = require('express');
const router = express.Router();

const {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal
} = require('../controller/jadwalController');

const { verifyToken } = require('../controller/authController');

// Middleware hanya untuk admin
const onlyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
};

// Lindungi semua route dengan token dan role admin
router.use(verifyToken, onlyAdmin);

// Route jadwal
router.post('/admin/jadwal', tambahJadwal);                 // Tambah jadwal
router.get('/admin/jadwal', getAllJadwal);                  // Ambil semua jadwal
router.get('/admin/jadwal/:jadwal_id', getJadwalById);      // Ambil 1 jadwal
router.put('/admin/jadwal/:jadwal_id', updateJadwal);       // Update jadwal
router.delete('/admin/jadwal/:jadwal_id', hapusJadwal);     // Hapus jadwal

module.exports = router;
