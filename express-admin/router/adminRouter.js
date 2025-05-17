const express = require('express');
const router = express.Router();
const {createAdmin, deleteAdmin, getAdminbyuser, getAllAdmin, editAdmin} = require('../controller/adminController');
const { verifyToken } = require('../controller/authController'); // ganti path jika perlu
const upload = require('../middleware/uploadProfile'); 

// Middleware untuk cek role admin
const onlyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Akses ditolak. Hanya admin yang diizinkan.' });
    }
    next();
};

// Lindungi semua route dengan token + role admin
router.use(verifyToken, onlyAdmin);

router.post('/admin/admin2', upload.single('foto_profile'), createAdmin);
router.put('/admin/admin2/:admin_id', upload.single('foto_profile'), editAdmin);
router.get('/admin/admin2', getAllAdmin);
router.get('/admin/admin2/:admin_id', getAdminbyuser);
router.delete('/admin/admin2/:admin_id', deleteAdmin);

module.exports = router;
