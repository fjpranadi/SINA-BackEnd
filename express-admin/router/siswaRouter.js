const express = require('express');
const router = express.Router();
const { tambahSiswa, hapusSiswa } = require('../controller/siswaController');
const { verifyToken } = require('../controller/authController');

router.post('/tambahSiswa', tambahSiswa);
router.delete('/hapusSiswa', hapusSiswa);

module.exports = router;
