const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const authController = require('./router/authRouter')
const guruController = require('./router/guruRouter')
const mapelRouter = require('./router/mapelRouter');
const adminRouter = require('./router/adminRouter')
const beritaRouter = require('./router/beritaRouter')
const kurikulumRouter = require('./router/kurikulumRouter')
require('dotenv').config();

const generateRandomFilename = (originalName) => {
  const ext = path.extname(originalName); // ambil ekstensi file, misalnya .jpg
  const randomStr = crypto.randomBytes(8).toString('hex'); // string hex random
  const timestamp = Date.now(); // timestamp unik
  return `${timestamp}_${randomStr}${ext}`;
};

// Public path untuk akses gambar profile
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

// PASANG CORS DI SINI
app.use(cors({
  origin: 'http://localhost:5173', // sesuaikan dengan frontend kamu
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json()); // untuk parsing application/json
app.use(express.urlencoded({ extended: true }));

app.use(express.json());
app.use('/api', authController);
app.use('/api', mapelRouter);
app.use('/api', guruController);
app.use('/api', adminRouter);
app.use('/api', beritaRouter);
app.use('/api', kurikulumRouter);




const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
