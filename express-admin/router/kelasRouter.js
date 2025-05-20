const express = require('express');
const router = express.Router();

const {
  tambahKelas,
  getAllKelas,
  getKelasById,
  updateKelas,
  hapusKelas
} = require('../controller/kelasController');

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

// Route kelas
router.post('/admin/kelas', tambahKelas); // Tambah kelas
router.get('/admin/kelas', getAllKelas);                                // Ambil semua kelas
router.get('/admin/kelas/:kelas_id', getKelasById);                  // Ambil 1 kelas by kelas_id
router.put('/admin/kelas/:kelas_id', updateKelas);                       // Update kelas
router.delete('/admin/kelas/:kelas_id', hapusKelas);                     // Hapus 

module.exports = router;
