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
getAbsensiByJadwal,
getSuratIzinSakit,
setujuiSuratIzin,
tolakSuratIzin,
getTahunAkademik,
getDetailTugas,
getDetailMateri
} = require('../controller/dashboardController');
const { getJadwalKelas } = require('../controller/jadwalController');
const { getProfileGuru, updateProfileGuru, updatePasswordGuru } = require('../controller/profileController');
const uploadlampirantugas = require('../middleware/uploadtugasMiddleware'); 
const uploadberitaguru = require('../middleware/uploadBeritaGuru');
const absensiController = require('../controller/absensiController');
const {
  getMapelByGuru,
  getKelasByMapelGuru,
  getSiswaByKelasAndMapel,
  inputNilaiRaporGuru,
  getStatistikNilaiBySiswaAndTahun
} = require('../controller/raportsiswaController');
const uploadprofile = require('../middleware/uploadProfile');

// Dashboard
router.get('/dashboard/count/', verifyToken, getdashboard);
router.get('/dashboard/jadwal/', verifyToken, getJadwalGuru);
router.get('/dashboard/siswa/:mapel_id', verifyToken, getSiswaByKelasGuru);
router.get('/dashboard/mapel/', verifyToken, getMapelGuru);

//detail materi n tugas
router.get('/dashboard/tugas/detail/:tugas_id', verifyToken, getDetailTugas);
router.get('/dashboard/materi/detail/:materi_id', verifyToken, getDetailMateri);

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
router.put('/dashboard/mapel/:mapel_id/tugas/:tugas_id/siswa/:krs_id/', verifyToken, beriNilaiTugasSiswa );


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

// Get tahunakademik
router.get('/dashboard/gettahunakademik', verifyToken, getTahunAkademik);


// Profile
router.get('/dashboard/profile', verifyToken, getProfileGuru);
router.put('/dashboard/profile', verifyToken, uploadprofile.single('foto_profil'), updateProfileGuru);
router.put('/dashboard/profile/password', verifyToken, updatePasswordGuru);


//verifikasi surat
router.get('/dashboard/surat-izin', verifyToken, getSuratIzinSakit);
router.put('/dashboard/surat-izin/:absensi_id/terima', verifyToken, setujuiSuratIzin);
router.put('/dashboard/surat-izin/:absensi_id/tolak', verifyToken, tolakSuratIzin);

// Raport
router.get('/dashboard/nilai/mapel', verifyToken, getMapelByGuru);
router.get('/dashboard/nilai/mapel/:mapel_id/kelas', verifyToken, getKelasByMapelGuru);
router.get('/dashboard/nilai/mapel/:mapel_id/kelas/:kelas_id/siswa', verifyToken, getSiswaByKelasAndMapel);
router.put('/dashboard/nilai/:krs_id/:status', verifyToken, inputNilaiRaporGuru);
router.get('/dashboard/nilai/statistik/:krs_id', verifyToken, getStatistikNilaiBySiswaAndTahun);
module.exports = router;