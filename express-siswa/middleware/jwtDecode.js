// middleware/jwtDecode.js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rahasia');
      req.user = decoded;
    } catch (err) {
      req.user = null;
    }
  }
  next();
};
