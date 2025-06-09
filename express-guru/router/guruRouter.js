const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const {
  getdashboard,
  getJadwalGuru,
  getSiswaByKelasGuru,
  getMapelGuru,
  createTugasForSiswa,
  createMateriForSiswa,
  getTugasGuruByMapel,
  getMateriGuruByMapel,
  getTugasDetailById,
  getMateriDetailById,
  createAbsensiSiswa,
  getBerita,
  getBeritaById,
createBeritaGuru,
  updateBeritaGuru,
  deleteBeritaGuru,
getSiswaPengumpulanTugas,
beriNilaiTugasSiswa 
} = require('../controller/dashboardController');
const { getJadwalKelas } = require('../controller/jadwalController');
const { getProfileGuru, updateProfileGuru } = require('../controller/profileController');
const uploadlampirantugas = require('../middleware/uploadtugasMiddleware'); 
const uploadberitaguru = require('../middleware/uploadBeritaGuru');

// Dashboard
router.get('/dashboard/', verifyToken, getdashboard);
router.get('/dashboard/jadwal/', verifyToken, getJadwalGuru);
router.get('/dashboard/siswa/:mapel_id', verifyToken, getSiswaByKelasGuru);
router.get('/dashboard/mapel/', verifyToken, getMapelGuru);
router.post('/dashboard/tugas/:mapel_id/', verifyToken, uploadlampirantugas.single('lampiran'), createTugasForSiswa);
router.post('/dashboard/materi/:mapel_id/', verifyToken, uploadlampirantugas.single('lampiran'), createMateriForSiswa);
// Add this to your router file
router.post('/dashboard/absensi/:mapel_id', verifyToken, createAbsensiSiswa);
router.get('/dashboard/tugas/:mapel_id', verifyToken, getTugasGuruByMapel);
router.get('/dashboard/mapel/:mapel_id/tugas/:tugas_id', verifyToken, getSiswaPengumpulanTugas );
router.get('/dashboard/mapel/:mapel_id/tugas/:tugas_id/siswa/:krs_id/', verifyToken, beriNilaiTugasSiswa );

router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/berita/:id', verifyToken, getBeritaById);
router.post('/dashboard/berita', uploadberitaguru.single('foto'), createBeritaGuru);
router.put('/dashboard/berita/:berita_id', uploadberitaguru.single('foto'), updateBeritaGuru);
router.delete('/dashboard/berita/:berita_id', deleteBeritaGuru);

// Get materials by subject
router.get('/dashboard/materi/:mapel_id', verifyToken, getMateriGuruByMapel);

// Get assignment details
router.get('/dashboard/tugas/detail/:tugas_id', verifyToken, getTugasDetailById);

// Get material details
router.get('/dashboard/materi/detail/:materi_id', verifyToken, getMateriDetailById);


// Profile
router.get('/dashboard/profile', verifyToken, getProfileGuru);
router.put('/dashboard/profile', verifyToken, updateProfileGuru);

module.exports = router;