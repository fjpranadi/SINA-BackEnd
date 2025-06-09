const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../Express-siswa/Upload/profile_image');
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

const uploadsiswa = multer({ storage: storage });

module.exports = uploadsiswa;
 