const express = require('express');
const app = express();
const cors = require('cors');
const guruRouter = require('./router/guruRouter');
const path = require('path');
const mongoose = require('./config/mongo');
const jwtDecode = require('./middleware/jwtDecode');
const logger = require('./middleware/logger');
require('dotenv').config();

// Pasang JWT decode
app.use(jwtDecode);

// Pasang logger setelah decode JWT
app.use(logger);

// Public path untuk akses gambar profile
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

app.use('/Upload/tugas', express.static(path.join(__dirname, 'Upload/tugas')));

// PASANG CORS DI SINI
app.use(cors({
  origin: 'http://localhost:5173', // sesuaikan dengan frontend kamu
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));


app.use(express.json());
app.use('/api', guruRouter);

const PORT = process.env.PORT || 3007;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
