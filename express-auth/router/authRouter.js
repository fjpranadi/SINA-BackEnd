const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');

// Endpoint login
router.post('/login', authController.login);


module.exports = router;
