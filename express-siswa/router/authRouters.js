const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');

// Endpoint login
router.post('/login', authController.login);
router.get('/profile', authController.verifyToken, (req, res) => {
    res.status(200).json({
        message: 'Ini data profil kamu',
        user: req.user, // isinya { userId, email, role }
    });
});

module.exports = router;
