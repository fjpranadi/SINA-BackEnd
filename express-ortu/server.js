const express = require('express');
const app = express();
const cors = require('cors');
const ortuRouter = require('./router/ortuRouter');
const path = require('path');
require('dotenv').config();

app.use('/Upload/surat', express.static(path.join(__dirname, 'Upload/surat')));

app.use(express.json());
app.use('/api', ortuRouter);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

