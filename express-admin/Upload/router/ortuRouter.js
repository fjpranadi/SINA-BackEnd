const express = require('express');
const router = express.Router();
const { tambahOrtu, hapusOrtu } = require('../controller/ortuController');
const ortuController = require('../controller/ortuController');

router.post('/tambahOrtu', tambahOrtu);
router.delete('/hapusOrtu', hapusOrtu);

module.exports = router;
