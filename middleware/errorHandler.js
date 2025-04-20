// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    // Set the status code (default to 500 if not provided)
    const statusCode = err.statusCode || 500;
  
    // Set the error message (default to a generic message if not provided)
    const message = err.message || 'Internal Server Error';
  
    // Send the error response
    res.status(statusCode).json({
      success: false,
      message,
      // Include the stack trace only in development mode for security
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  };
  
  module.exports = errorHandler;