const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'your_super_secret_key_here_min_32_chars',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + (parseInt(process.env.JWT_REFRESH_EXPIRE) || 7) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  new ApiResponse(statusCode, { user, token }, message).send(res);
};

/**
 * Register User
 */
exports.signup = async (req, res, next) => {
  try {
    const { name, email, password, role, contactNumber } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new ApiError(400, 'Email is already registered.'));
    }

    const newUser = await User.create({
      name,
      email,
      password,
      role: role || 'tenant',
      contactNumber
    });

    createSendToken(newUser, 201, res, 'User registered successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * Log In User
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return next(new ApiError(400, 'Please provide email and password.'));
    }

    // Find user and select password field
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new ApiError(401, 'Incorrect email or password.'));
    }

    createSendToken(user, 200, res, 'Logged in successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * Log Out User
 */
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  new ApiResponse(200, null, 'Logged out successfully.').send(res);
};

/**
 * Get Current User Profile
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    new ApiResponse(200, { user }, 'Profile retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Update Profile
 */
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, contactNumber } = req.body;
    const updateData = { name, contactNumber };

    // If an avatar is uploaded
    if (req.file) {
      // In production we upload to Cloudinary. For now, store local path.
      updateData.profilePicture = req.file.path.includes('public')
        ? `/uploads/${req.file.filename}`
        : req.file.path;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    new ApiResponse(200, { user: updatedUser }, 'Profile updated successfully.').send(res);
  } catch (error) {
    next(error);
  }
};
