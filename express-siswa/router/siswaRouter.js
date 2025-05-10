const express = require('express');
const router = express.Router();
const { verifyToken } = require('../controller/authController');
const { getDashboardSiswa, editDataDiriSiswa } = require('../controller/dashboardController');


router.get('/dashboard', verifyToken, getDashboardSiswa);
router.put('/dashboard', verifyToken, editDataDiriSiswa);



module.exports = router;
