const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getBiodataOrtu, getSiswaByOrtu, getBerita, editBiodataOrtu, getStatistikNilai, getRekapAbsensi, postSuratIzin, getTugasSiswa} = require('../controller/dashboardController');
const uploadprofile = require('../middleware/uploadProfile');
const uploadSurat = require('../middleware/uploadSurat');

router.get('/dashboard/biodata', verifyToken, getBiodataOrtu);
router.get('/dashboard/siswa', verifyToken, getSiswaByOrtu);
router.get('/dashboard/berita', verifyToken, getBerita);
router.put('/dashboard/biodata', verifyToken, uploadprofile.single('foto_profil'), editBiodataOrtu); //perubahan dari sini
router.get('/dashboard/nilai/', verifyToken, getStatistikNilai);
router.get('/dashboard/absen/', verifyToken, getRekapAbsensi);
router.post(
  '/dashboard/surat-izin',
  verifyToken,
  uploadSurat.single('surat'),  // harus sesuai field file di form-data Postman
  postSuratIzin
);
router.get('/dashboard/tugas/', verifyToken, getTugasSiswa);


module.exports = router;