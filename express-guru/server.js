const express = require('express');
const app = express();
const guruRouter = require('./router/guruRouter');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

app.use('/Upload/tugas', express.static(path.join(__dirname, 'Upload/tugas')));

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
 

