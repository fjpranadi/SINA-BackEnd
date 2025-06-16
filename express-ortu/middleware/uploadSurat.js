const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Buat direktori jika belum ada
const dir = 'Upload/surat';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Konfigurasi storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    cb(null, `${timestamp}_${basename}${ext}`);
  }
});

// Filter file
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('File harus berupa PDF, JPG, JPEG, atau PNG'));
  }
};

// Batas ukuran: 2MB
const uploadSurat = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: fileFilter
});

module.exports = uploadSurat;
