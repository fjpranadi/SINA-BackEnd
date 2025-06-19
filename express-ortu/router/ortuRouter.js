// routes/dashboardRoute.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { 
  getBiodataOrtu, 
  getSiswaByOrtu, 
  getBerita, 
  editBiodataOrtu,
  submitSuratIzin,
  getDashboardCountOrtu,
getJadwalSiswaOrtu,
getJadwalSiswaOrtuByHari,
getRiwayatAbsensiSiswa  
} = require('../controller/dashboardController');
const uploadSurat = require('../middleware/uploadSurat'); // Middleware baru untuk upload surat
const uploadprofile = require('../middleware/uploadProfile'); 

router.get('/dashboard/biodata', verifyToken, getBiodataOrtu);
router.get('/dashboard/siswa', verifyToken, getSiswaByOrtu);
router.get('/dashboard/berita', verifyToken, getBerita);
router.put('/dashboard/biodata', verifyToken, uploadprofile.single('foto_profil'), editBiodataOrtu);
router.post('/dashboard/ajukan-surat', verifyToken, uploadSurat.single('surat'), submitSuratIzin);
router.get('/dashboard/:nis', verifyToken, getDashboardCountOrtu);
router.get('/dashboard/jadwal/:nis', verifyToken, getJadwalSiswaOrtu);
router.get('/dashboard/jadwal/:nis/:hari', verifyToken, getJadwalSiswaOrtuByHari);
router.get('/dashboard/riwayat-absensi/:nis', verifyToken, getRiwayatAbsensiSiswa);

module.exports = router;