const express = require('express');
const router = express.Router();
const {createKurikulum, deleteKurikulum, getAllkurikulum, getkurikulumlById, updateKurikulum} = require('../controller/kurikulumController');
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

router.get('/admin/kurikulum', getAllkurikulum);
router.get('/admin/kurikulum/:id', getkurikulumlById);
router.post('/admin/kurikulum/', createKurikulum);
router.put('/admin/kurikulum/:id', updateKurikulum);
router.delete('/admin/kurikulum/:id', deleteKurikulum);

module.exports = router;
