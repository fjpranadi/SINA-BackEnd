const express = require('express');
const router = express.Router();
const {getberitalByIdlanding, getAllberitalanding} = require('../controller/beritaController');

router.get('/berita/landing', getAllberitalanding);
router.get('/berita/landing/:id', getberitalByIdlanding);

module.exports = router;
