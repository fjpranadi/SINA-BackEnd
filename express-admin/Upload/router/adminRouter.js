const express = require('express');
const router = express.Router();
const {createAdmin, deleteAdmin, getAdminbyuser, getAllAdmin, editAdmin} = require('../controller/adminController');
const { verifySuperAdmin} = require('../controller/authController'); // ganti path jika perlu
const upload = require('../middleware/uploadProfile'); 

router.post('/admin/admin2',verifySuperAdmin, upload.single('foto_profile'), createAdmin);
router.put('/admin/admin2/:admin_id',verifySuperAdmin, upload.single('foto_profile'), editAdmin);
router.get('/admin/admin2',verifySuperAdmin, getAllAdmin);
router.get('/admin/admin2/:admin_id',verifySuperAdmin, getAdminbyuser);
router.delete('/admin/admin2/:admin_id',verifySuperAdmin, deleteAdmin);

module.exports = router;
