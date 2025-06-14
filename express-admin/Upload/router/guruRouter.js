const express = require('express');
const router = express.Router();
const {createGuru,getAllGuru,getGuruByNip,deleteGuru} = require('../controller/guruController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu
const upload = require('../middleware/uploadProfile'); 

// Middleware untuk cek role admin

router.post('/admin/guru',verifyAdmin, upload.single('foto_profile'), createGuru);
router.get('/admin/guru',verifyAdmin, getAllGuru);
router.get('/admin/guru/:nip',verifyAdmin, getGuruByNip);
router.delete('/admin/guru/:nip',verifyAdmin, deleteGuru);

module.exports = router;
