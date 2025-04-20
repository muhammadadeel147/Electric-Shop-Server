

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
// Register a new user
exports.register = async (req, res, next) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, password } = req.body;

  try {
    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      const error = new Error('User already exists');
      error.status = 400;
      return next(error); // Pass the error to the centralized error handler
    }

    // Create new user
    user = new User({
      name,
      email,
      password,
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Save user to database
    await user.save();

    // Create JWT
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) return next(err); // Pass the error to the centralized error handler
        res.json({ token });
      }
    );
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
};

// Login user
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    console.log('Login Request - Email:', email);

    // Convert email to lowercase for case-insensitive comparison
    const user = await User.findOne({ email: email.toLowerCase() });
    console.log('Database Query Result:', user);

    if (!user) {
      const error = new Error('Invalid credentials');
      error.status = 400;
      return next(error);
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password Match:', isMatch);

    if (!isMatch) {
      const error = new Error('Invalid credentials');
      error.status = 400;
      return next(error);
    }

    // Create JWT
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '5d' },
      (err, token) => {
        if (err) return next(err);
        res.json({ token });
      }
    );
  } catch (err) {
    next(err);
  }
};
// Get user data
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      return next(error); // Pass the error to the centralized error handler
    }
    res.json(user);
  } catch (err) {
    next(err); // Pass the error to the centralized error handler
  }
};
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      return next(error);
    }

    // Generate reset token
    const resetToken = user.getResetPasswordToken();

    // Save the token and expiration to the database
    await user.save();

    // Create reset URL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    // Email message
    const message = `
    <div style="font-family: 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f4; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1); padding: 30px;">
        
        <h2 style="color: #333; text-align: center;">🔒 Reset Your Password</h2>
        
        <p style="font-size: 16px; color: #555;">
          Hello,
        </p>
        
        <p style="font-size: 16px; color: #555;">
          We received a request to reset the password for your <strong>Electric Shop</strong> account. If this was you, click the button below to reset your password.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" 
             style="background-color: #007BFF; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Reset Password
          </a>
        </div>
        
        <p style="font-size: 14px; color: #999;">
          If you didn’t request a password reset, you can safely ignore this email. This link will expire in 1 hour for your security.
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="font-size: 12px; color: #bbb; text-align: center;">
          &copy; ${new Date().getFullYear()} Electric Shop. All rights reserved.
        </p>
      </div>
    </div>
  `;
  
    // Send email
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "3d15eef30bfe16",
        pass: "776839bc14f56e"
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Reset Your Password - Electric Shop',
      html: message
    });

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    next(error);
  }
};
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the token and find the user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }, // Ensure token is not expired
    });

    if (!user) {
      const error = new Error('Invalid or expired token');
      error.status = 400;
      return next(error);
    }

    // Update the user's password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // Clear the reset token and expiration
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
};
