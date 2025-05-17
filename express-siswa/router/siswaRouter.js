const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { verifyToken } = require('../controller/authController');
const { getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa } = require('../controller/dashboardController');
const { getMateri, getTugas, getMapelKelas, getJumlahTugasMateri, getTugasDetail, getMateriDetail} = require('../controller/mapelController');
const { getAbsensi, getRingkasanAbsensi} = require('../controller/absensiController');
const { getBiodataSiswa, getJadwalSiswa, editDataDiriSiswa, getBerita, getMateriSiswa, getTugasSiswa, editTugasSiswa } = require('../controller/dashboardController');
const uploadtugas = require('../middleware/uploadtugasMiddleware'); 

router.get('/dashboard/biodata', verifyToken, getBiodataSiswa);
router.get('/dashboard/jadwal', verifyToken, getJadwalSiswa);
router.put('/dashboard/biodata', verifyToken, editDataDiriSiswa);
router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/mapel/:jadwal_id', verifyToken, getMateriSiswa);
router.get('/dashboard/tugas/:jadwal_id', verifyToken, getTugasSiswa);
router.put('/dashboard/tugas/:tugas_id', uploadtugas.single('lampiran'), verifyToken, editTugasSiswa);

// Mapel
router.get('/mapel-kelas', verifyToken, getMapelKelas);
router.get('/jumlahTugasMateri', verifyToken, getJumlahTugasMateri);

// Mapel Detail
router.get('/materi', verifyToken, getMateri);
router.get('/tugas', verifyToken, getTugas);

// Tugas & Materi Detail routes
router.get('/materiDetail/:materi_id', verifyToken, getMateriDetail);
router.get('/tugasDetail/:tugas_id', verifyToken, getTugasDetail);

// Riwayat Absensi
router.get('/absensi', verifyToken, getAbsensi);
router.get('/ringkasan', verifyToken, getRingkasanAbsensi);

module.exports = router;