const express = require('express');
const router = express.Router();
const {createMapel,deleteMapel,getMapelById,getAllMapel,updateMapel} = require('../controller/mapelController');
const { verifyToken } = require('../controller/authController'); // ganti path jika perlu

// Middleware untuk cek role admin
const onlyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
    }
    next();
};

// Lindungi semua route dengan token + role admin
router.use(verifyToken, onlyAdmin);

router.get('/admin/mapel', getAllMapel);
router.get('/admin/mapel/:id', getMapelById);
router.post('/admin/mapel/', createMapel);
router.put('/admin/mapel/:id', updateMapel);
router.delete('/admin/mapel/:id', deleteMapel);

module.exports = router;
