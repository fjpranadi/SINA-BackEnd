const express = require('express');
const app = express();
const cors = require('cors');
const ortuRouter = require('./router/ortuRouter');
const path = require('path');
const mongoose = require('./config/mongo');
const jwtDecode = require('./middleware/jwtDecode');
const logger = require('./middleware/logger');

require('dotenv').config();

// Pasang JWT decode
app.use(jwtDecode);

// Pasang logger setelah decode JWT
app.use(logger);

app.use('/Upload/surat', express.static(path.join(__dirname, 'Upload/surat')));
app.use('/Upload/profile_image', express.static(path.join(__dirname, 'Upload/profile_image')));

app.use(express.json());
app.use('/api', ortuRouter);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

