const ApiLog = require('../models/ApiLog');

const logger = (req, res, next) => {
  console.log('🟢 Masuk ke middleware logger'); // PENTING

  const oldSend = res.send;
  let responseBody;

  res.send = function (body) {
    responseBody = body;
    return oldSend.apply(res, arguments);
  };

  res.on('finish', () => {
    console.log('📌 Logger aktif:', req.method, req.originalUrl);
    ApiLog.create({
      method: req.method,
      endpoint: req.originalUrl,
      requestBody: req.body,
      responseBody: tryParseJson(responseBody),
      statusCode: res.statusCode,
      userId: req.user?.userId || null,
    })
    .then(() => console.log('✅ Log masuk MongoDB'))
    .catch(err => console.error('❌ Gagal log:', err.message));
  });

  next();
};

function tryParseJson(json) {
  try {
    return JSON.parse(json);
  } catch {
    return json;
  }
}

module.exports = logger;
