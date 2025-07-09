const express = require('express');
const router = express.Router();

const {
  tambahJadwal,
  getAllJadwal,
  getJadwalById,
  updateJadwal,
  hapusJadwal,
  getJadwalByJadwalId,
  getKelasJadwal,
  hapusJadwalByKelasId,
  getGuruTersediaByKelas
} = require('../controller/jadwalController');
const { verifyAdmin } = require('../controller/authController');

// Route jadwal
router.post('/admin/jadwal',verifyAdmin, tambahJadwal);                 // Tambah jadwal
router.get('/admin/jadwal', getAllJadwal);                  // Ambil semua jadwal
router.get('/admin/jadwal/:kelas_id',verifyAdmin, getJadwalById);      // Ambil 1 jadwal
router.get('/admin/jadwaldetail/:jadwal_id',verifyAdmin, getJadwalByJadwalId);      // Ambil 1 jadwal
router.put('/admin/jadwal/:jadwal_id',verifyAdmin, updateJadwal);       // Update jadwal
router.delete('/admin/jadwal/:jadwal_id',verifyAdmin, hapusJadwal);     // Hapus jadwal
router.get('/admin/kelas-jadwal', verifyAdmin, getKelasJadwal);
router.delete('/admin/jadwalbykelas/:kelas_id', verifyAdmin,hapusJadwalByKelasId);
router.get('/admin/guru-tersedia/:kelas_id', verifyAdmin, getGuruTersediaByKelas);

module.exports = router;
