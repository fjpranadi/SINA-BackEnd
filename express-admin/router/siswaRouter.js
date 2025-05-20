const express = require('express');
const router = express.Router();

const {
  tambahSiswa,
  getAllSiswa,
  getSiswaByUserId,
  updateSiswa,
  hapusSiswa
} = require('../controller/siswaController');

const { verifyAdmin } = require('../controller/authController');
const upload = require('../middleware/uploadProfile'); 

// Middleware untuk cek role admin
const onlyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
  }
  next();
};

// Lindungi semua route
router.use(verifyToken, onlyAdmin);

// Route siswaa
router.post('/admin/siswa', upload.single('foto_profil'), tambahSiswa); // Tambah siswa
router.get('/admin/siswa', getAllSiswa);                                // Ambil semua siswa
router.get('/admin/siswa/:user_id', getSiswaByUserId);                  // Ambil 1 siswa by user_id
router.put('/admin/siswa/:user_id', updateSiswa);                       // Update siswa
router.delete('/admin/siswa/:user_id', hapusSiswa);                     // Hapus 

module.exports = router;
