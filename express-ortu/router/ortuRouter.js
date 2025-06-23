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
  getRiwayatAbsensiSiswa,
  getStatistikNilaiSiswa,
  getRiwayatSuratIzin,
  getDetailSuratIzin  
} = require('../controller/dashboardController');

const uploadSurat = require('../middleware/uploadSurat');
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
router.get('/dashboard/statistik/:nis', verifyToken, getStatistikNilaiSiswa);
router.get('/dashboard/surat-izin/:nis', verifyToken, getRiwayatSuratIzin);
router.get('/dashboard/surat-izin/detail/:absensi_id', verifyToken, getDetailSuratIzin);

module.exports = router;
