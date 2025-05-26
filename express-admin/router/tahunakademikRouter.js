const express = require('express');
const router = express.Router();

const {
  tambahTahunAkademik,
  getAllTahunAkademik,
  getTahunAkademikById,
  updateTahunAkademik,
  hapusTahunAkademik
} = require('../controller/tahunakademikController');

const { verifyAdmin } = require('../controller/authController');

// Route kelas
router.post('/admin/tahunakademik',verifyAdmin, tambahTahunAkademik); // Tambah tahunakademik
router.get('/admin/tahunakademik',verifyAdmin, getAllTahunAkademik);                                // Ambil semua tahunakademik
router.get('/admin/tahunakademik/:tahun_akademik_id',verifyAdmin, getTahunAkademikById);                  // Ambil 1 tahunakademik by tahunakademik_id
router.put('/admin/tahunakademik/:tahun_akademik_id',verifyAdmin, updateTahunAkademik);                       // Update kelas
router.delete('/admin/tahunakademik/:tahun_akademik_id',verifyAdmin, hapusTahunAkademik);                     // Hapus 

module.exports = router;
