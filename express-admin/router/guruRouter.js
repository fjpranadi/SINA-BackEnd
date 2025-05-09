const express = require('express');
const router = express.Router();
const {createGuru,getAllGuru,updateGuru,getGuruByNip,deleteGuru} = require('../controller/guruController');
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

router.post('/admin/guru', createGuru);
router.get('/admin/guru', getAllGuru);
router.get('/admin/guru/:nip', getGuruByNip);
router.put('/admin/guru/:nip', updateGuru);
router.delete('/admin/guru/:nip', deleteGuru);

module.exports = router;
