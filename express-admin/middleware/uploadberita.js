const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage_berita = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Upload/berita';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
  cb(null, file.originalname);
}

});

const uploadberita = multer({ storage: storage_berita });

module.exports = uploadberita;
