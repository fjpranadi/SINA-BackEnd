const express = require('express');
const app = express();
const authController = require('./router/authRouter')
const guruController = require('./router/guruRouter')
const mapelRouter = require('./router/mapelRouter');
require('dotenv').config();

app.use(express.json());
app.use('/api', authController);
app.use('/api', mapelRouter);
app.use('/api', guruController);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
