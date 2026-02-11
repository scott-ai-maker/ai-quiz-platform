// JWT Authentication Middleware
const jwt = require('jsonwebtoken');

// This must match the secret used in your auth-service
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'super-secret-jwt-key-change-in-production';

//Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    // Get token from headers
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'No token provided'
        });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user info to request object
        req.user = {
            username: decoded.sub,
            userId: decoded.user_id
        };

        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        });
    }
};

module.exports = { verifyToken };