const express = require('express');
const app = express();
const siswaRouter = require('./router/siswaRouter');
require('dotenv').config();

app.use(express.json());
app.use('/api', siswaRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


