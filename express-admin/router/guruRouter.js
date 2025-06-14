const express = require('express');
const router = express.Router();
const {createGuru,getAllGuru,getGuruByNip,deleteGuru, updateGuru} = require('../controller/guruController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu
const uploadguru = require('../middleware/uploadProfileguru'); 

// Middleware untuk cek role admin

router.post('/admin/guru',verifyAdmin, uploadguru.single('foto_profile'), createGuru);
router.get('/admin/guru',verifyAdmin, getAllGuru);
router.get('/admin/guru/:nip',verifyAdmin, getGuruByNip);
router.delete('/admin/guru/:nip',verifyAdmin, deleteGuru);
router.put('/admin/guru/:nip', verifyAdmin, uploadguru.single('foto_profile'), updateGuru);

module.exports = router;
