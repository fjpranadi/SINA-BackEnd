const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getMapelKelasGuru, getTugasGuruByMapel, getMateriGuruByMapel, getTugasDetailById, getMateriDetailById,  updateMateriById, updateTugasById } = require('../controller/mapelController');
const { getTugasTerbaru } = require('../controller/dashboardController');
const { getJadwalKelas } = require('../controller/jadwalController');
const { getProfileGuru, updateProfileGuru } = require('../controller/profileController');

// Dashboard
router.get('/dashboard/tugas-terbaru', verifyToken, getTugasTerbaru);

// Mapel
router.get('/dashboard/mapel-kelas', verifyToken, getMapelKelasGuru);
router.get('/dashboard/tugas/:mapel_id', verifyToken, getTugasGuruByMapel);
router.get('/dashboard/materi/:mapel_id', verifyToken, getMateriGuruByMapel);
router.get('/dashboard/tugasDetail/:tugas_id', verifyToken, getTugasDetailById);
router.get('/dashboard/materiDetail/:materi_id', verifyToken, getMateriDetailById);
router.put('/dashboard/updateTugas/:tugas_id', verifyToken, updateTugasById);
router.put('/dashboard/updateMateri/:materi_id', verifyToken, updateMateriById);

// Jadwal
router.get('/dashboard/jadwal-kelas', verifyToken, getJadwalKelas);

// Profile
router.get('/dashboard/profile', verifyToken, getProfileGuru);
router.put('/dashboard/profile', verifyToken, updateProfileGuru);

module.exports = router;