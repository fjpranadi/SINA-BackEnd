const express = require('express');
const app = express();
const siswaRouter = require('./router/siswaRouter');
const kurikulumController = require('./router/kurikulumRouter');
const ortuRouter = require('./router/ortu');
const authController = require('./router/authRouters')
require('dotenv').config();

app.use(express.json());
app.use('/api', siswaRouter);
app.use('/api', kurikulumController);
app.use('/api', ortuRouter);
app.use('/api', authController);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
