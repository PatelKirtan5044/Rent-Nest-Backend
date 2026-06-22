const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get recent 30 notifications for the logged-in user
 */
exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30);

    new ApiResponse(200, { notifications }, 'Notifications retrieved successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications for the user as read
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { $set: { read: true } }
    );

    new ApiResponse(200, null, 'All notifications marked as read.').send(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete all notifications associated with the user
 */
exports.clearNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user.id });

    new ApiResponse(200, null, 'All notifications cleared.').send(res);
  } catch (error) {
    next(error);
  }
};
