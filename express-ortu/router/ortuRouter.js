const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getBiodataOrtu, getSiswaByOrtu, getBerita, editBiodataOrtu} = require('../controller/dashboardController');
const uploadprofile = require('../middleware/uploadProfile'); 

router.get('/dashboard/biodata', verifyToken, getBiodataOrtu);
router.get('/dashboard/siswa', verifyToken, getSiswaByOrtu);
router.get('/dashboard/berita', verifyToken, getBerita);
router.put('/dashboard/biodata', verifyToken, uploadprofile.single('foto_profil'), editBiodataOrtu);

module.exports = router;