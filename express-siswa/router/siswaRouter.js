const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { verifyToken } = require('../controller/authController');
const { getMateri, getTugas, getMapelKelas, getJumlahTugasMateri, getTugasDetail, getMateriDetail} = require('../controller/mapelController');
const { getAbsensi, getRingkasanAbsensi} = require('../controller/absensiController');
const { getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa, editTugasSiswa } = require('../controller/dashboardController');
const uploadtugas = require('../middleware/uploadtugasMiddleware'); 

router.get('/dashboard/biodata', verifyToken, getBiodataSiswa);
router.get('/dashboard/jadwal', verifyToken, getJadwalSiswa);
router.put('/dashboard/biodata', verifyToken, editDataDiriSiswa);
router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/materi/:jadwal_id', verifyToken, getMateriSiswa);
router.get('/dashboard/tugas/:jadwal_id', verifyToken, getTugasSiswa);
router.put('/dashboard/tugas/:tugas_id', uploadtugas.single('lampiran'), verifyToken, editTugasSiswa);

// Mapel
router.get('/dashboard/mapel-kelas', verifyToken, getMapelKelas);
router.get('/dashboard/jumlahTugasMateri', verifyToken, getJumlahTugasMateri);


// Mapel Detail
router.get('/dashboard/materi', verifyToken, getMateri);
router.get('/dashboard/tugas', verifyToken, getTugas);

// Tugas & Materi Detail routes
router.get('/dashboard/materiDetail/:materi_id', verifyToken, getMateriDetail);
router.get('/tugasDetail/:tugas_id', verifyToken, getTugasDetail);

// Riwayat Absensi
router.get('/dashboard/absensi', verifyToken, getAbsensi);
router.get('/dashboard/ringkasan', verifyToken, getRingkasanAbsensi);

module.exports = router;