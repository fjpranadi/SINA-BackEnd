const express = require('express');
const router = express.Router();
const { createKurikulum, deleteKurikulum, readKurikulum, updateKurikulum } = require('../controller/kurikulumController');

router.post('/kurikulum', createKurikulum);
router.get('/kurikulum', readKurikulum);
router.put('/kurikulum/:id', updateKurikulum);
router.delete('/kurikulum/:id', deleteKurikulum);

module.exports = router;
