// file: routes/highlightRoutes.js (atau file router Anda)
const express = require('express');
const router = express.Router();

// Impor semua fungsi yang sudah kita buat di controller
const {
  getCountGuru,
  getCountSiswa,
  getCountAdmin,
  getCountPengumuman,
  getCountAbsenSiswa,
  getCountAbsenGuru
} = require('../controller/highlightController');

const { verifyAdmin } = require('../controller/authController');

// Definisikan 4 route baru, satu untuk setiap fungsi
router.get('/admin/count/guru',  getCountGuru);
router.get('/admin/count/siswa', getCountSiswa);
router.get('/admin/count/admin',  getCountAdmin);
router.get('/admin/count/pengumuman', verifyAdmin, getCountPengumuman);
router.get('/admin/count/absenguru', verifyAdmin, getCountAbsenGuru);
router.get('/admin/count/absensiswa', verifyAdmin, getCountAbsenSiswa);

module.exports = router; 