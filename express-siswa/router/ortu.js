const express = require('express');
const router = express.Router();
const ortuController = require('../controller/ortuController');

router.post('/ortu', ortuController.addOrtu);
router.get('/ortu', ortuController.getOrtu);
router.put('/ortu/:nik', ortuController.updateOrtu);

module.exports = router;
