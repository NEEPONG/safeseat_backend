const express = require('express');
const router = express.Router();
const AdminController = require('../../controllers/admin/adminController');
const { authenticateToken, requireRole } = require('../../middlewares/authMiddleware');

const adminAuth = [authenticateToken, requireRole('admin')];

// POST /api/admin/login  -> เข้าสู่ระบบ
router.post('/login', AdminController.login);

// GET /api/admin/stats  -> ดึงสถิติจำนวนคนขับ สถานบันเทิง และรายงานทั้งหมด
router.get('/stats', adminAuth, AdminController.getStats);

// GET /api/admin/drivers  -> ดึงรายชื่อคนขับทั้งหมดพร้อมเอกสารสมัคร
router.get('/drivers', adminAuth, AdminController.getDrivers);

// GET /api/admin/pubs  -> ดึงรายชื่อสถานประกอบการทั้งหมด
router.get('/pubs', adminAuth, AdminController.getPubs);

// PUT /api/admin/drivers/:username/status -> เปลี่ยนสถานะการอนุมัติคนขับ
router.put('/drivers/:username/status', adminAuth, AdminController.updateDriverStatus);

// PUT /api/admin/pubs/:username/status -> เปลี่ยนสถานะการอนุมัติสถานบันเทิง
router.put('/pubs/:username/status', adminAuth, AdminController.updatePubStatus);

// GET /api/admin/driver-reports -> ดึงประวัติรายงานความประพฤติคนขับทั้งหมด
router.get('/driver-reports', adminAuth, AdminController.getDriverReports);

// GET /api/admin/user-reports -> ดึงประวัติรายงานความประพฤติลูกค้าทั้งหมด
router.get('/user-reports', adminAuth, AdminController.getUserReports);

// PUT /api/admin/driver-reports/:id/status -> อัปเดตสถานะใบแจ้งรายงานคนขับ
router.put('/driver-reports/:id/status', adminAuth, AdminController.updateDriverReportStatus);

// PUT /api/admin/user-reports/:id/status -> อัปเดตสถานะใบแจ้งรายงานผู้ใช้
router.put('/user-reports/:id/status', adminAuth, AdminController.updateUserReportStatus);

module.exports = router;
