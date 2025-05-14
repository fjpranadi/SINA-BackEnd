const express = require('express');
const router = express.Router();
const authController = require('../controller/authController');
const { verifyToken } = require('../controller/authController');
const upload = require('../middleware/uploadProfile');

// Endpoint login
router.post('/admin/login', authController.login);
router.put('/admin/profile', verifyToken, (req, res, next) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      return res.status(500).json({ message: 'Upload error: ' + err.message });
    }
    next();
  });
}, authController.editProfile);


router.get('/admin/profile', verifyToken, authController.getProfile);


module.exports = router;
