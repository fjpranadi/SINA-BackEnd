const express = require('express');
const router = express.Router();
const {createberita, deleteberita, getAllberita, getberitalById} = require('../controller/beritaController');
const { verifyToken } = require('../controller/authController'); // ganti path jika perlu
const uploadberita = require('../middleware/uploadberita');

// Middleware untuk cek role admin
const onlyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
    }
    next();
};

// Lindungi semua route dengan token + role admin
router.use(verifyToken, onlyAdmin);

router.get('/admin/berita', getAllberita);
router.get('/admin/berita/:id', getberitalById);
router.post('/admin/berita/',uploadberita.single('foto'), createberita);
router.delete('/admin/berita/:id', deleteberita);

module.exports = router;
