const express = require('express');
const router = express.Router();

const {
  tambahTahunAkademik,
  getAllTahunAkademik,
  getTahunAkademikById,
  updateTahunAkademik,
  hapusTahunAkademik
} = require('../controller/tahunakademikController');

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
router.post('/admin/tahunakademik', tambahTahunAkademik); // Tambah tahunakademik
router.get('/admin/tahunakademik', getAllTahunAkademik);                                // Ambil semua tahunakademik
router.get('/admin/tahunakademik/:tahun_akademik_id', getTahunAkademikById);                  // Ambil 1 tahunakademik by tahunakademik_id
router.put('/admin/tahunakademik/:tahun_akademik_id', updateTahunAkademik);                       // Update kelas
router.delete('/admin/tahunakademik/:tahun_akademik_id', hapusTahunAkademik);                     // Hapus 

module.exports = router;
