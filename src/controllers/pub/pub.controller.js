// ═══════════════════════════════════════════════════════════════
// controllers/pub.controller.js  —  ตัวกลางระหว่าง Route กับ Service
//
// หน้าที่ของ Controller:
//  1. รับข้อมูลจาก req (request) ที่ client ส่งมา
//  2. ส่งต่อไปให้ Service ทำ business logic
//  3. ส่ง response กลับ (JSON) พร้อม HTTP status code ที่เหมาะสม
//
// Controller ไม่ควรมี business logic เอง
// เพื่อให้แยก concern ออกจากกัน (Separation of Concerns)
// ═══════════════════════════════════════════════════════════════

const pubService = require('../../services/pub/pub.service')
const { uploadToSupabase } = require('../../utils/supabaseStorage')

// ── Login Handler ─────────────────────────────────────────────
// รับ POST /api/pub/login
// Body: { username: string, password: string }
const login = async (req, res) => {
  try {
    // ดึง username, password จาก request body
    const { username, password } = req.body

    // ส่งให้ service ตรวจสอบ — ถ้าผิดพลาด service จะ throw Error
    const pub = await pubService.loginPub(username, password)

    // สำเร็จ: ส่งข้อมูล pub กลับไปให้ Frontend
    // Frontend เก็บลง localStorage ใช้เป็น session
    res.json({ success: true, data: pub })
  } catch (err) {
    // เกิด error: ส่ง HTTP 400 พร้อมข้อความ error
    // 400 Bad Request = ข้อมูลที่ส่งมาไม่ถูกต้อง
    res.status(400).json({ success: false, message: err.message })
  }
}

// ── Register Handler ──────────────────────────────────────────
// รับ POST /api/pub/register
// Body: multipart/form-data (มีไฟล์แนบ เช่น ใบอนุญาต, รูปหน้าร้าน)
const register = async (req, res) => {
  try {
    // นำข้อมูล text fields มาใส่ใน pubData
    const pubData = { ...req.body }

    // อัปโหลดรูปภาพไปยัง Supabase Storage และเก็บ URL แทน path ของเครื่อง local
    if (req.files) {
      if (req.files.regisImagePath) {
        pubData.regisImagePath = await uploadToSupabase(req.files.regisImagePath[0], 'images', 'pubs/profile')
      }
      if (req.files.pubImagePath) {
        // อัปโหลดเพื่อเคลียร์โฟลเดอร์ uploads และเผื่อกรณีที่ต้องการใช้งานรูปหน้าร้านในอนาคต
        await uploadToSupabase(req.files.pubImagePath[0], 'images', 'pubs/storefront')
      }
    }

    // ส่งข้อมูลที่เตรียมไว้ไปให้ service บันทึกลงฐานข้อมูล
    const result = await pubService.registerPub(pubData)

    // สำเร็จ: ส่ง HTTP 201 Created พร้อมข้อมูล pub ที่สร้างใหม่
    // 201 Created บ่งบอกว่ามีการสร้างข้อมูลใหม่ในฐานข้อมูล
    res.status(201).json({ success: true, data: result })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// ── Check Email Handler ─────────────────────────────────────────
// รับ POST /api/pub/check-email
// Body: { email: string }
const checkEmail = async (req, res) => {
  try {
    const { email } = req.body
    await pubService.checkEmail(email)
    res.json({ success: true, message: 'อีเมลนี้สามารถใช้งานได้' })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
}

// ── Get Registration Status Handler ─────────────────────────────────
// รับ GET /api/pub/status/:username
// Params: username (ผ่าน URL param)
// Response: { success: true, data: { regisstatus, regisdate, pubname, ... } }
const getStatus = async (req, res) => {
  try {
    const { username } = req.params
    const statusData = await pubService.getRegistrationStatus(username)
    res.json({ success: true, data: statusData })
  } catch (err) {
    // 404 Not Found — ไม่พบผู้ประกอบการนี้
    const status = err.message.includes('ไม่พบ') ? 404 : 400
    res.status(status).json({ success: false, message: err.message })
  }
}

// ── Get Profile Handler ───────────────────────────────────────────────
// รับ GET /api/pub/profile/:username
// Params: username (ผ่าน URL param)
// Response: { success: true, data: pubProfileObject }
const getProfile = async (req, res) => {
  try {
    const { username } = req.params
    const profile = await pubService.getProfile(username)
    res.json({ success: true, data: profile })
  } catch (err) {
    const status = err.message.includes('ไม่พบ') ? 404 : 400
    res.status(status).json({ success: false, message: err.message })
  }
}

module.exports = { login, register, checkEmail, getStatus, getProfile }