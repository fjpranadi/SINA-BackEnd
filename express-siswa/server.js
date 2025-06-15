
const express = require('express');
const app = express();
const siswaRouter = require('./router/siswaRouter');
const path = require('path');
require('dotenv').config();


// Public path untuk akses gambar profile
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

app.use('/Upload/tugas', express.static(path.join(__dirname, 'Upload/tugas')));


app.use(express.json());
app.use('/api', siswaRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});

