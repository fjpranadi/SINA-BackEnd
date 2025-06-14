const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storageberita = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'Upload/berita';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
filename: (req, file, cb) => {
  const uniqueName = Date.now() + '-' + file.originalname;
  cb(null, uniqueName);
}


});

const uploadberita = multer({ storage: storageberita });

module.exports = uploadberita;
