const express = require('express');
const router = express.Router();
const {
  tambahSiswa,
  getAllSiswa,
  updateSiswa,
  deleteSiswa,
  getSiswaBynis,
  importSiswaFromExcel,
  getRekapAbsenSiswa,
  sendEmailToStudentByNis,
  getRaporSiswa
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
router.post('/admin/siswa/:kelas_id', verifyAdmin, uploadsiswa.single('fileExcel'), importSiswaFromExcel); 
router.get('/admin/siswa/rekap/:kelas_id',verifyAdmin, getRekapAbsenSiswa);  
router.post('/admin/siswa/sendemail/:nis', verifyAdmin, sendEmailToStudentByNis);
router.get('/admin/siswa/rapor/:nis',verifyAdmin, getRaporSiswa);


//beda njir


module.exports = router;
