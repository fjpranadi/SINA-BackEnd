const express = require('express');
const app = express();
const guruRouter = require('./router/guruRouter');
require('dotenv').config();

app.use(express.json());
app.use('/api', guruRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
