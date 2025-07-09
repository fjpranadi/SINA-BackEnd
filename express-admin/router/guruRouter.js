const express = require('express');
const router = express.Router();
const {createGuru,getAllGuru,getGuruByNip,deleteGuru, updateGuru,getRekapAbsenGuru, sendEmailToAllGuru, sendEmailToGuruByNip} = require('../controller/guruController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu
const uploadguru = require('../middleware/uploadProfileguru'); 
const {   sendEmailToAllStudents } = require('../controller/siswaController');

// Middleware untuk cek role admin

router.post('/admin/guru',verifyAdmin, uploadguru.single('foto_profile'), createGuru);
router.get('/admin/guru',verifyAdmin, getAllGuru);
router.get('/admin/guru/:nip',verifyAdmin, getGuruByNip);
router.delete('/admin/guru/:nip',verifyAdmin, deleteGuru);
router.put('/admin/guru/:nip', verifyAdmin, uploadguru.single('foto_profile'), updateGuru);
router.get('/admin/guru/rekap/:tahun_akademik_id',verifyAdmin, getRekapAbsenGuru);
router.post('/admin/guru/sendemail', verifyAdmin, sendEmailToAllGuru);
router.post('/admin/guru/sendemail/:nip', verifyAdmin, sendEmailToGuruByNip);
router.post('/admin/siswa/sendemail', verifyAdmin, sendEmailToAllStudents);  

module.exports = router;
