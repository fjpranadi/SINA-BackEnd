const express = require('express');
const router = express.Router();
const {createMapel,deleteMapel,getMapelById,getAllMapel,updateMapel} = require('../controller/mapelController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu

// Middleware untuk cek role admin

router.get('/admin/mapel',verifyAdmin, getAllMapel);
router.get('/admin/mapel/:id',verifyAdmin, getMapelById);
router.post('/admin/mapel/',verifyAdmin, createMapel);
router.put('/admin/mapel/:id',verifyAdmin, updateMapel);
router.delete('/admin/mapel/:id',verifyAdmin, deleteMapel);

module.exports = router;
