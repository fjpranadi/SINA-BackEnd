// config/mongo.js
const mongoose = require('mongoose');

const uri = 'mongodb+srv://gedeangga424:asdfghjkl@cluster0.g7fbdcd.mongodb.net/logs?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('✅ Connected to MongoDB Atlas'));

module.exports = mongoose;
