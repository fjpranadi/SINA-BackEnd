const express = require('express');
const app = express();
const cors = require('cors');
const authController = require('./router/authRouter')
require('dotenv').config();

// PASANG CORS DI SINI
app.use(cors({
  origin: 'http://localhost:5173', // sesuaikan dengan frontend kamu
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());
app.use('/api', authController);


const PORT = process.env.PORT || 3005;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
