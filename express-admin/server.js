const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const authController = require('./router/authRouter')
const guruController = require('./router/guruRouter')
const mapelRouter = require('./router/mapelRouter');
const siswaRouter = require('./router/siswaRouter');
const kelasRouter = require('./router/kelasRouter');
const tahunakademikRouter = require('./router/tahunakademikRouter');
const jadwalRouter = require('./router/jadwalRouter');
const adminRouter = require('./router/adminRouter')
const beritaRouter = require('./router/beritaRouter')
const beritalandingRouter = require('./router/beritalandingRouter')
const kurikulumRouter = require('./router/kurikulumRouter')
const highlightRouter = require('./router/highlightRouter')
const mongoose = require('./config/mongo');
const jwtDecode = require('./middleware/jwtDecode');
const logger = require('./middleware/logger');

require('dotenv').config();

// Pasang JWT decode
app.use(jwtDecode);

// Pasang logger setelah decode JWT
app.use(logger);

const generateRandomFilename = (originalName) => {
  const ext = path.extname(originalName); // ambil ekstensi file, misalnya .jpg
  const randomStr = crypto.randomBytes(8).toString('hex'); // string hex random
  const timestamp = Date.now(); // timestamp unik
  return `${timestamp}_${randomStr}${ext}`;
};

// Public path untuk akses gambar profile
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

app.use('/Upload/berita', express.static(path.join(__dirname, 'Upload/berita')));

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
app.use('/api', beritalandingRouter);
app.use('/api', kurikulumRouter);
app.use('/api', siswaRouter);
app.use('/api', kelasRouter);
app.use('/api', tahunakademikRouter);
app.use('/api', jadwalRouter);
app.use('/api', highlightRouter);






const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
