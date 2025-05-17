const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa, editTugasSiswa } = require('../controller/dashboardController');
const uploadtugas = require('../middleware/uploadtugasMiddleware'); 

router.get('/dashboard/biodata', verifyToken, getBiodataSiswa);
router.get('/dashboard/jadwal', verifyToken, getJadwalSiswa);
router.put('/dashboard/biodata', verifyToken, editDataDiriSiswa);
router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/mapel/:jadwal_id', verifyToken, getMateriSiswa);
router.get('/dashboard/tugas/:jadwal_id', verifyToken, getTugasSiswa);
router.put('/dashboard/tugas/:tugas_id', uploadtugas.single('lampiran'), verifyToken, editTugasSiswa);





module.exports = router;
