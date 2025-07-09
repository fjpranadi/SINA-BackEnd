const express = require('express');
const router = express.Router();
const {getberitalByIdlanding, getAllberitalanding} = require('../controller/beritaController');

router.get('/admin/berita/landing', getAllberitalanding);
router.get('/admin/berita/landing/:id', getberitalByIdlanding);

module.exports = router;
