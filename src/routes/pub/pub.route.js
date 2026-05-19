// ═══════════════════════════════════════════════════════════════
// routes/pub.route.js  —  กำหนด URL endpoints ของ Pub
//
// ทุก route ที่นี่จะมี prefix /api/pub (กำหนดใน server.js)
// ทำให้ URL จริงคือ:
//   POST /api/pub/login               → รับการเข้าสู่ระบบ
//   POST /api/pub/register            → รับการสมัครสมาชิก
//   POST /api/pub/check-email         → ตรวจสอบอีเมลซ้ำ
//   GET  /api/pub/status/:username    → ดูสถานะการลงทะเบียน
//   GET  /api/pub/profile/:username   → ดูข้อมูล profile ของร้าน
//
// Pattern: Route → Controller → Service → Model → Database
// ไฟล์นี้เป็นแค่ "ตัวเชื่อม" ระหว่าง URL กับ Controller function
// ═══════════════════════════════════════════════════════════════

const express = require('express')
const router  = express.Router() // สร้าง Router instance แยกจาก app หลัก
const multer  = require('multer')

// กำหนดให้ multer เก็บไฟล์แนบไว้ในโฟลเดอร์ uploads/ ชั่วคราว
const upload = multer({ dest: 'uploads/' })

// Import controller functions (เป็น async functions ที่จัดการ req/res)
const { login, register, checkEmail, getStatus, getProfile } = require('../../controllers/pub/pub.controller')

// ── Endpoints ─────────────────────────────────────────────────

// POST /api/pub/login
// Body: { username, password }
// Response: { success: true, data: pubObject } หรือ { success: false, message }
router.post('/login', login)

// POST /api/pub/check-email
// Body: { email }
// Response: { success: true, message } หรือ { success: false, message }
router.post('/check-email', checkEmail)

// POST /api/pub/register
// Body: multipart/form-data (มีไฟล์แนบ)
// Response: { success: true, data: newPubObject } หรือ { success: false, message }
// upload.fields จะรับไฟล์จาก field 'regisImagePath' และ 'pubImagePath' พร้อมแปลง text field ลงใน req.body
router.post('/register', upload.fields([
  { name: 'regisImagePath', maxCount: 1 },
  { name: 'pubImagePath', maxCount: 1 }
]), register)

// GET /api/pub/status/:username
// Params: username
// Response: { success: true, data: { regisstatus, regisdate, pubname, pubemail, pubphone, regisimagepath } }
// ใช้หน้า View Registration Status เพื่อดูสถานะ pending / approved / rejected
router.get('/status/:username', getStatus)

// GET /api/pub/profile/:username
// Params: username
// Response: { success: true, data: pubProfileObject } (ไม่รวม password)
// ใช้แสดงข้อมูล pub ทั้งหมดสำหรับ dashboard หรือ profile page
router.get('/profile/:username', getProfile)

module.exports = router