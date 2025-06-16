const express = require('express');
const router = express.Router();
const {createKurikulum, deleteKurikulum, getAllkurikulum, getkurikulumlById, updateKurikulum, getMapelByTahunAkademik} = require('../controller/kurikulumController');
const { verifyAdmin } = require('../controller/authController'); // ganti path jika perlu

// Middleware untuk cek role admin

router.get('/admin/kurikulum',verifyAdmin, getAllkurikulum);
router.get('/admin/kurikulum/:id',verifyAdmin, getkurikulumlById);
router.get('/admin/mapel-kelas/:kelas_id',verifyAdmin, getMapelByTahunAkademik);
router.post('/admin/kurikulum/',verifyAdmin, createKurikulum);
router.put('/admin/kurikulum/:id',verifyAdmin, updateKurikulum);
router.delete('/admin/kurikulum/:id',verifyAdmin, deleteKurikulum);

module.exports = router;
