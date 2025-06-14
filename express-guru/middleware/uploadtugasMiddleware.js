// middlewares/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'Upload/tugas'); // Folder untuk menyimpan file
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tugas-${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Hanya file PDF yang diperbolehkan'), false);
  }
};

const uploadlampirantugas = multer({ storage, fileFilter });

module.exports = uploadlampirantugas;
