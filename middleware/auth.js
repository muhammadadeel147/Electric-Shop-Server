// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const token = req.header('Authorization');

    // Check if no token
    if (!token || !token.startsWith('Bearer ')) {
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Extract token from Bearer string
    const jwtToken = token.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);

    // Get user from DB and attach to req
    req.user = await User.findById(decoded.user.id).select('-password');

    next();
  } catch (err) {
    console.error(err.message);
    res.status(401).json({ msg: 'Token is not valid' });
  }
};
