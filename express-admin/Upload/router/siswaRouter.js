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

// Route siswaa
router.post('/admin/siswa',verifyAdmin, upload.single('foto_profil'), tambahSiswa); // Tambah siswa
router.get('/admin/siswa',verifyAdmin, getAllSiswa);                                // Ambil semua siswa
router.get('/admin/siswa/:user_id',verifyAdmin, getSiswaByUserId);                  // Ambil 1 siswa by user_id
router.put('/admin/siswa/:user_id',verifyAdmin, updateSiswa);                       // Update siswa
router.delete('/admin/siswa/:user_id',verifyAdmin, hapusSiswa);                     // Hapus 

module.exports = router;
