const mongoose = require('mongoose');

const apiLogSchema = new mongoose.Schema({
  method: String,
  endpoint: String,
  requestBody: Object,
  responseBody: Object,
  statusCode: Number,
  userId: String,
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApiLog', apiLogSchema);
