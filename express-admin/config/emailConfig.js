const nodemailer = require('nodemailer');

// Konfigurasi transporter SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail', // Gunakan service Gmail
  host: 'smtp.gmail.com', // Host SMTP Gmail
  port: 587, // Port untuk TLS
  secure: false, // true untuk port 465, false untuk port lain
  auth: {
    user: process.env.EMAIL_USER, // Email pengirim
    pass: process.env.EMAIL_PASSWORD // App Password (bukan password email biasa)
  },
  tls: {
    rejectUnauthorized: false // Untuk development, matikan di production
  }
});

// Verifikasi koneksi SMTP
transporter.verify((error, success) => {
  if (error) {
    console.error('Error verifikasi SMTP:', error);
  } else {
    console.log('Server SMTP siap mengirim email');
  }
});

module.exports = transporter;