const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getBiodataOrtu, getSiswaByOrtu, getBerita, editBiodataOrtu, ubahPasswordOrtu, getInformasiAnakByNis} = require('../controller/dashboardController');
const upload = require('../middleware/uploadProfile'); 

router.get('/dashboard/biodata', verifyToken, getBiodataOrtu);
router.get('/dashboard/siswa', verifyToken, getSiswaByOrtu);
router.get('/dashboard/berita', verifyToken, getBerita);
router.get('/dashboard/siswa/:nis', verifyToken, getInformasiAnakByNis);
router.put('/dashboard/biodata', verifyToken, upload.single('foto_profil'), editBiodataOrtu);
router.put('/dashboard/password', verifyToken, ubahPasswordOrtu);



module.exports = router;