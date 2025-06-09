const express = require('express');
const router = express.Router();

const {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal
} = require('../controller/jadwalController');
const { verifyAdmin } = require('../controller/authController');

// Route jadwal
router.post('/admin/jadwal',verifyAdmin, tambahJadwal);                 // Tambah jadwal
router.get('/admin/jadwal', getAllJadwal);                  // Ambil semua jadwal
router.get('/admin/jadwal/:jadwal_id',verifyAdmin, getJadwalById);      // Ambil 1 jadwal
router.put('/admin/jadwal/:jadwal_id',verifyAdmin, updateJadwal);       // Update jadwal
router.delete('/admin/jadwal/:jadwal_id',verifyAdmin, hapusJadwal);     // Hapus jadwal

module.exports = router;
