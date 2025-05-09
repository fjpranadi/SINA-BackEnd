const express = require('express');
const app = express();
const authController = require('./router/authRouter')
const siswaController = require('./router/siswaRouter')
const ortuController = require('./router/ortuRouter')
require('dotenv').config();

app.use(express.json());
app.use('/api', authController);
app.use('/api', siswaController);
app.use('/api', ortuController);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
