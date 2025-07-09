const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const ortuController = require('../controller/ortuController');

// Endpoint login
router.post('/login', authController.login);

// Endpoint registrasi ortu (3 tahap)
router.post('/register/ortu', ortuController.registerOrtu);
router.post('/register/ortu/verify-otp', ortuController.verifyOtp);
router.post('/register/ortu/complete', ortuController.completeRegistration);

module.exports = router;