const express = require('express');
const router = express.Router();
const { tambahSiswa, hapusSiswa } = require('../controllers/siswaController');
const { verifyToken } = require('../controller/authController');

router.post('/tambah', tambahSiswa);
router.delete('/hapus', hapusSiswa);

module.exports = router;
