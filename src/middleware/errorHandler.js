export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Handle ProductError specifically
    if (err.name === 'ProductError') {
      return res.status(400).json({
        error: err.message,
        type: err.type,
        details: err.details,
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle other errors
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
