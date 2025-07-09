const express = require('express');
const router = express.Router();

const {
  tambahKelas,
  getAllKelas,
  getKelasAktif,
  getKelasById,
  updateKelas,
  hapusKelas,
  getSiswaByKelasId
} = require('../controller/kelasController');

const { verifyAdmin } = require('../controller/authController');

// Route kelas
router.post('/admin/kelas',verifyAdmin, tambahKelas); // Tambah kelas
router.get('/admin/kelas',verifyAdmin, getAllKelas);                                // Ambil semua kelas
router.get('/admin/kelas/aktif',verifyAdmin, getKelasAktif);  
router.get('/admin/kelas/:kelas_id',verifyAdmin, getKelasById);                  // Ambil 1 kelas by kelas_id
router.put('/admin/kelas/:kelas_id',verifyAdmin, updateKelas);                       // Update kelas
router.delete('/admin/kelas/:kelas_id',verifyAdmin, hapusKelas);                     // Hapus
router.get('/admin/siswa_kelas/:kelas_id',verifyAdmin, getSiswaByKelasId);  

module.exports = router;
