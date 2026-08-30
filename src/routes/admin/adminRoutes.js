const express = require('express');
const router = express.Router();
const AdminController = require('../../controllers/admin/adminController');

// POST /api/admin/login  -> เข้าสู่ระบบ
router.post('/login', AdminController.login);

// GET /api/admin/stats  -> ดึงสถิติจำนวนคนขับ ร้านค้า และรายงานทั้งหมด
router.get('/stats', AdminController.getStats);

// GET /api/admin/drivers  -> ดึงรายชื่อคนขับทั้งหมดพร้อมเอกสารสมัคร
router.get('/drivers', AdminController.getDrivers);

// GET /api/admin/pubs  -> ดึงรายชื่อร้านประกอบการทั้งหมด
router.get('/pubs', AdminController.getPubs);

// PUT /api/admin/drivers/:username/status -> เปลี่ยนสถานะการอนุมัติคนขับ
router.put('/drivers/:username/status', AdminController.updateDriverStatus);

// PUT /api/admin/pubs/:username/status -> เปลี่ยนสถานะการอนุมัติร้านค้า
router.put('/pubs/:username/status', AdminController.updatePubStatus);

// GET /api/admin/driver-reports -> ดึงประวัติรายงานความประพฤติคนขับทั้งหมด
router.get('/driver-reports', AdminController.getDriverReports);

// GET /api/admin/user-reports -> ดึงประวัติรายงานความประพฤติลูกค้าทั้งหมด
router.get('/user-reports', AdminController.getUserReports);

// PUT /api/admin/driver-reports/:id/status -> อัปเดตสถานะใบแจ้งรายงานคนขับ
router.put('/driver-reports/:id/status', AdminController.updateDriverReportStatus);

// PUT /api/admin/user-reports/:id/status -> อัปเดตสถานะใบแจ้งรายงานผู้ใช้
router.put('/user-reports/:id/status', AdminController.updateUserReportStatus);

module.exports = router;
