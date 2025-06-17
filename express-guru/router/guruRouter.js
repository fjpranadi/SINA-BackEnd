const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const {
  getdashboard,
  getJadwalGuru,
  getSiswaByKelasGuru,
  getMapelGuru,
  createTugasForSiswa,
    updateTugasById,
    deleteTugasById,
  createMateriForSiswa,
    updateMateriById,
    deleteMateriById,
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
beriNilaiTugasSiswa,
getAbsensiByJadwal
} = require('../controller/dashboardController');
const { getJadwalKelas } = require('../controller/jadwalController');
const { getProfileGuru, updateProfileGuru } = require('../controller/profileController');
const uploadlampirantugas = require('../middleware/uploadtugasMiddleware'); 
const uploadberitaguru = require('../middleware/uploadBeritaGuru');
const { getListRapor, getSemesterOptions, getStatistikNilai } = require('../controller/raporController');
const absensiController = require('../controller/absensiController');
// Dashboard
router.get('/dashboard/', verifyToken, getdashboard);
router.get('/dashboard/jadwal/', verifyToken, getJadwalGuru);
router.get('/dashboard/siswa/:mapel_id', verifyToken, getSiswaByKelasGuru);
router.get('/dashboard/mapel/', verifyToken, getMapelGuru);

// API for tugas
router.post('/dashboard/tugas/:mapel_id/', verifyToken, uploadlampirantugas.single('lampiran'), createTugasForSiswa);
router.put('/dashboard/tugas/:tugas_id', verifyToken, uploadlampirantugas.single('lampiran'), updateTugasById);
router.delete('/dashboard/tugas/:tugas_id', verifyToken, deleteTugasById);
router.get('/dashboard/tugas/:mapel_id', verifyToken, getTugasGuruByMapel);

// API for materi
router.post('/dashboard/materi/:mapel_id/', verifyToken, uploadlampirantugas.single('lampiran'), createMateriForSiswa);
router.put('/dashboard/materi/:materi_id', verifyToken, uploadlampirantugas.single('lampiran'), updateMateriById);
router.delete('/dashboard/materi/:materi_id', verifyToken, deleteMateriById);

// Add this to your router file
router.get('/dashboard/mapel/:mapel_id/tugas/:tugas_id', verifyToken, getSiswaPengumpulanTugas );
router.get('/dashboard/mapel/:mapel_id/tugas/:tugas_id/siswa/:krs_id/', verifyToken, beriNilaiTugasSiswa );


router.get('/dashboard/absensi/:jadwal_id', verifyToken, getAbsensiByJadwal);
router.post('/dashboard/absensi/:jadwal_id', verifyToken, createAbsensiSiswa);

router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/berita/:id', verifyToken, getBeritaById);
router.post('/dashboard/berita',verifyToken, uploadberitaguru.single('foto'), createBeritaGuru);
router.put('/dashboard/berita/:berita_id',verifyToken, uploadberitaguru.single('foto'), updateBeritaGuru);
router.delete('/dashboard/berita/:berita_id',verifyToken, deleteBeritaGuru);

// Get materials by subject
router.get('/dashboard/materi/:mapel_id', verifyToken, getMateriGuruByMapel);

// Get assignment details
router.get('/dashboard/tugas/detail/:tugas_id', verifyToken, getTugasDetailById);

// Get material details
router.get('/dashboard/materi/detail/:materi_id', verifyToken, getMateriDetailById);


// Profile
router.get('/dashboard/profile', verifyToken, getProfileGuru);
router.put('/dashboard/profile', verifyToken, updateProfileGuru);

// Rapor
router.get('/dashboard/rapor', verifyToken, getListRapor);
router.get('/dashboard/rapor/semester-options', verifyToken, getSemesterOptions);
router.get('/dashboard/rapor/statistik', verifyToken, getStatistikNilai);

module.exports = router;