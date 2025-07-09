const express = require('express');
const router = express.Router();
const {createberita, deleteberita, getAllberita, getberitalById, editberita, getberitalByIdlanding, getAllberitalanding} = require('../controller/beritaController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu
const uploadberita = require('../middleware/uploadberita');

router.get('/admin/berita',verifyAdmin, getAllberita);
router.get('/admin/berita/:id',verifyAdmin, getberitalById);
router.post('/admin/berita/',verifyAdmin, uploadberita.single('foto'), createberita);
router.put('/admin/berita/:id',verifyAdmin, uploadberita.single('foto'), editberita);
router.delete('/admin/berita/:id',verifyAdmin, deleteberita);

module.exports = router;
