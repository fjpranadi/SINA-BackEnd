const express = require('express');
const app = express();
const ortuRouter = require('./router/ortuRouter');
require('dotenv').config();

app.use(express.json());
app.use('/api', ortuRouter);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

