const express = require('express');
const app = express();
const cors = require('cors');
const path = require('path');
const authController = require('./router/authRouter')
const guruController = require('./router/guruRouter')
const mapelRouter = require('./router/mapelRouter');
require('dotenv').config();

// Public path untuk akses gambar profile
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

// PASANG CORS DI SINI
app.use(cors({
  origin: 'http://localhost:5173', // sesuaikan dengan frontend kamu
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use('/api', authController);
app.use('/api', mapelRouter);
app.use('/api', guruController);




const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
