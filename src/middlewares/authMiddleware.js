// ═══════════════════════════════════════════════════════════════
// middlewares/authMiddleware.js — JWT Authentication & RBAC
// ═══════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'safeseat_jwt_secret_key_2026';
const JWT_EXPIRES_IN = '7d';

/**
 * สร้าง JWT Token เมื่อเข้าสู่ระบบสำเร็จ
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Middleware สำหรับตรวจสอบความถูกต้องของ Bearer Token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required / กรุณาเข้าสู่ระบบก่อนใช้งาน'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token / Token ไม่ถูกต้องหรือหมดอายุแล้ว'
      });
    }
    req.user = user;
    next();
  });
};

/**
 * Middleware สำหรับตรวจสอบ Role-Based Access Control (RBAC)
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: insufficient permissions / คุณไม่มีสิทธิ์เข้าถึงส่วนนี้'
      });
    }
    next();
  };
};

module.exports = {
  generateToken,
  authenticateToken,
  requireRole,
  JWT_SECRET
};
