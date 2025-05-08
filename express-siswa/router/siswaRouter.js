const express = require('express');
const router = express.Router();
const { tambahSiswa, cariSiswa, editSiswa, deleteSiswa, } = require('../controller/siswaController');
const { verifyToken } = require('../controller/authController');
const { getDashboardSiswa, editDataDiriSiswa } = require('../controller/dashboardController');


router.post('/siswa', tambahSiswa);
router.get('/siswa', cariSiswa);
router.put('/siswa/:nis', editSiswa);
router.delete('/siswa/:nis', deleteSiswa);
router.get('/dashboard', verifyToken, getDashboardSiswa);
router.put('/dashboard', verifyToken, editDataDiriSiswa);



module.exports = router;
