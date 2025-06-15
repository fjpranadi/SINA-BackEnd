const express = require('express');
const router = express.Router();
const {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis,
  importSiswaFromExcel
} = require('../controller/siswaController');

const { verifyAdmin } = require('../controller/authController');
const upload = require('../middleware/uploadProfile'); 
const uploadsiswa = require('../middleware/uploadProfileSiswa'); 

// Route siswaa
router.post('/admin/siswa',verifyAdmin, uploadsiswa.single('foto_profil'), tambahSiswa); // Tambah siswa
router.get('/admin/siswa',verifyAdmin, getAllSiswa);                                // Ambil semua siswa
router.get('/admin/siswa/:nis',verifyAdmin, getSiswaBynis);                  // Ambil 1 siswa by user_id
router.put('/admin/siswa/:nis',verifyAdmin,  uploadsiswa.single('foto_profil'),  updateSiswa);                       // Update siswa
router.delete('/admin/siswa/:nis',verifyAdmin, deleteSiswa);                     // Hapus
router.post('/admin/siswa/import', verifyAdmin, uploadsiswa.single('fileExcel'), importSiswaFromExcel); 

module.exports = router;
