const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { verifyToken } = require('../controller/authController');
const { getMateri, getTugas, getMapelKelas, getJumlahTugasMateri, getTugasDetail, getMateriDetail} = require('../controller/mapelController');
const { getAbsensi, getRingkasanAbsensi} = require('../controller/absensiController');
const { 
  getBiodataSiswa, 
  getJadwalSiswa, 
  editDataDiriSiswa, 
  getBerita, 
  getMateriSiswa, 
  getTugasSiswa, 
  editTugasSiswa, 
  getBeritaById, 
  getDashboardRingkasanSiswa, 
  getJadwalSiswabyhari,
  getMateriHariIni,
  getSiswaCount
} = require('../controller/dashboardController');
const uploadtugas = require('../middleware/uploadtugasMiddleware'); 
const uploadprofile = require('../middleware/uploadProfile'); 
const { getListRapor, getSemesterOptions, getStatistikNilai } = require('../controller/raporController');

router.get('/dashboard/biodata', verifyToken, getBiodataSiswa);
router.get('/dashboard/count', verifyToken, getSiswaCount);
router.get('/dashboard', verifyToken, getDashboardRingkasanSiswa);
router.get('/dashboard/materi-hari-ini', verifyToken, getMateriHariIni);
router.get('/dashboard/jadwal', verifyToken, getJadwalSiswa);
router.get('/dashboard/jadwal/:hari', verifyToken, getJadwalSiswabyhari);
router.put('/dashboard/biodata', verifyToken,uploadprofile.single('foto_profil'), editDataDiriSiswa);
router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/berita/:id', verifyToken, getBeritaById);
router.put('/dashboard/tugas/:tugas_id',verifyToken, uploadtugas.single('file_jawaban'), editTugasSiswa);

// Mapel
router.get('/dashboard/mapel-kelas', verifyToken, getMapelKelas);
router.get('/dashboard/jumlahTugasMateri', verifyToken, getJumlahTugasMateri);

// Mapel Detail
router.get('/dashboard/materi', verifyToken, getMateri);
router.get('/dashboard/tugas/:mapel_id', verifyToken, getTugas);

// Tugas & Materi Detail routes
router.get('/dashboard/materiDetail/:materi_id', verifyToken, getMateriDetail);
router.get('/dashboard/tugasDetail/:tugas_id', verifyToken, getTugasDetail);

// Riwayat Absensi
router.get('/dashboard/absensi', verifyToken, getAbsensi);
router.get('/dashboard/ringkasan', verifyToken, getRingkasanAbsensi);

// Rapor
router.get('/dashboard/rapor', verifyToken, getListRapor);
router.get('/dashboard/rapor/semester-options', verifyToken, getSemesterOptions);
router.get('/dashboard/rapor/statistik', verifyToken, getStatistikNilai);

module.exports = router;