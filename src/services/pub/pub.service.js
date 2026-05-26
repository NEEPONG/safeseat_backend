// ═══════════════════════════════════════════════════════════════
// services/pub.service.js  —  Business Logic หลักของ Pub
//
// หน้าที่ของ Service:
//  1. Validate ข้อมูลที่รับมาจาก Controller (server-side validation)
//  2. ทำ business logic เช่น ตรวจสอบ username ซ้ำ
//  3. เรียก Model เพื่อ query ฐานข้อมูล
//  4. คืนผลลัพธ์กลับ Controller
//
// หมายเหตุ: Validate ทั้ง Frontend และ Backend
//   Frontend = UX ที่ดี (แจ้งผู้ใช้ทันที)
//   Backend  = ความปลอดภัย (ป้องกันการส่งข้อมูลผิดโดยตรง)
// ═══════════════════════════════════════════════════════════════

const PubModel = require('../../models/pub/pub.model')
const bcrypt = require('bcrypt')

// ── Regex Patterns ────────────────────────────────────────────
// ตัวแปร regex นิยามนอก function เพื่อ compile ครั้งเดียว (ประหยัด memory)

// username: ตัวอักษรภาษาอังกฤษหรือตัวเลข 2-50 ตัว ไม่มีช่องว่าง
const usernameRegex = /^[a-zA-Z0-9]{2,50}$/

// password: ตัวอักษร ตัวเลข และ ! # _ . เท่านั้น 2-50 ตัว
const passwordRegex = /^[a-zA-Z0-9!#_.]{2,50}$/

// ════════════════════════════════════════════════════════════════
// registerPub — ลงทะเบียน Pub ใหม่
// ════════════════════════════════════════════════════════════════
const registerPub = async (pubData) => {

  // Destructuring: แยก field ที่ต้องการออกจาก pubData object
  // pubData มาจาก req.body ของ Controller
  const {
    username, password,
    pubName, pubEmail, pubPhone,
    pubAddress, pubAddressLat, pubAddressLng,
    taxNumber, pubOpen, pubClose,
    bankAccountNo, bankAccountName,
    regisImagePath,
  } = pubData

  // แปลงค่า Lat/Lng จาก String (ที่ได้จาก FormData) เป็น Number
  const lat = pubAddressLat ? parseFloat(pubAddressLat) : undefined
  const lng = pubAddressLng ? parseFloat(pubAddressLng) : undefined

  // ── Validation 1: ตรวจสอบ required fields ──────────────────
  // ทุก field ต้องมีค่า (ไม่เป็น null, undefined, หรือ string ว่าง)
  if (
    !username || !password || !pubName || !pubEmail || !pubPhone ||
    !pubAddress ||
    lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng) || // lat/lng ต้องมีค่าและเป็นตัวเลข
    !taxNumber || !bankAccountNo || !bankAccountName
  ) {
    throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน')
  }

  // ── Validation 2: ตรวจสอบรูปแบบ username ──────────────────
  if (!usernameRegex.test(username)) {
    throw new Error('ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษหรือตัวเลข 2–50 ตัว และห้ามมีช่องว่าง')
  }

  // ── Validation 3: ตรวจสอบรูปแบบ password ──────────────────
  // อนุญาตเฉพาะ a-z, A-Z, 0-9 และอักขระพิเศษ ! # _ .
  if (!passwordRegex.test(password)) {
    throw new Error('รหัสผ่านต้องเป็นภาษาอังกฤษ ตัวเลข และ ! # _ . เท่านั้น')
  }

  // ── Validation 4: ตรวจสอบเบอร์โทรศัพท์ ────────────────────
  // ^0        = ขึ้นต้นด้วย 0
  // [0-9]{8,9} = ตามด้วยตัวเลข 8-9 ตัว (รวมทั้งหมด 9-10 หลัก)
  if (!/^0[0-9]{8,9}$/.test(pubPhone)) {
    throw new Error('หมายเลขโทรศัพท์ไม่ถูกต้อง')
  }

  // ── Validation 5: ตรวจสอบ lat/lng เป็น number จริง ─────────
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    throw new Error('กรุณาปักหมุดตำแหน่งร้านผ่านแผนที่')
  }

  // ── Validation 6: เลขผู้เสียภาษี 13 หลัก ──────────────────
  if (!/^[0-9]{13}$/.test(taxNumber)) {
    throw new Error('เลขผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')
  }

  // ── Validation 7: เลขที่บัญชีธนาคาร ────────────────────────
  // ยอมรับตัวเลข 1-150 หลัก
  if (!/^[0-9]{1,150}$/.test(bankAccountNo)) {
    throw new Error('เลขที่บัญชีต้องเป็นตัวเลขเท่านั้น')
  }

  // ── Validation 8: ชื่อบัญชีธนาคาร ──────────────────────────
  // ยอมรับภาษาไทย (ก-๙), อังกฤษ (a-zA-Z) และช่องว่าง (\s)
  if (!/^[ก-๙a-zA-Z\s]{1,150}$/.test(bankAccountName)) {
    throw new Error('ชื่อบัญชีต้องเป็นภาษาไทยหรืออังกฤษเท่านั้น')
  }

  // ── ตรวจสอบ username ซ้ำ (query ฐานข้อมูล) ─────────────────
  // ต้องทำหลังจาก validate format แล้ว เพื่อไม่ query ถ้าข้อมูลผิดอยู่แล้ว
  const existing = await PubModel.findByUsername(username)
  if (existing) {
    throw new Error('ข้อมูลผู้ใช้ซ้ำ กรุณาลองใหม่อีกครั้ง')
  }

  // ── ตรวจสอบ email ซ้ำ ───────────────────────────────────────
  const existingEmail = await PubModel.findByEmail(pubEmail)
  if (existingEmail) {
    throw new Error('อีเมลนี้มีในระบบแล้ว กรุณาใช้อีเมลอื่น')
  }

  // ── Insert ข้อมูลลง Supabase ─────────────────────────────────
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(password, salt)

  return await PubModel.create({
    username,
    password: hashedPassword,

    pubname:  pubName,
    pubemail: pubEmail,
    pubphone: pubPhone,

    pubopen:  pubOpen,
    pubclose: pubClose,

    taxnumber: taxNumber,

    bankaccountno:   bankAccountNo,
    bankaccountname: bankAccountName,

    pubaddresslat: lat,
    pubaddresslng: lng,
    regisimagepath: regisImagePath || null,

    // กำหนด status เริ่มต้นเป็น 'pending' (รอ admin อนุมัติ)
    regisstatus: 'pending',
    // บันทึกวันที่สมัคร (JavaScript Date object)
    regisdate:   new Date(),
  })
}

// ════════════════════════════════════════════════════════════════
// loginPub — ตรวจสอบ username + password
//
// หมายเหตุ: ฟังก์ชันนี้ยังไม่ได้ export (ขาดหายใน module.exports)
//          ต้องเพิ่ม loginPub ใน module.exports เพื่อให้ controller ใช้ได้
// ════════════════════════════════════════════════════════════════
const loginPub = async (username, password) => {
  // ค้นหา pub จาก username ในฐานข้อมูล
  const pub = await PubModel.findByUsername(username)

  if (!pub) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }

  const isMatch = await bcrypt.compare(password, pub.password)
  
  if (!isMatch) {
    throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  }

  // คืนข้อมูล pub กลับไป (Controller จะส่งให้ Frontend เก็บลง localStorage)
  return pub
}

// ════════════════════════════════════════════════════════════════
// checkEmail — ตรวจสอบอีเมลซ้ำ
// ════════════════════════════════════════════════════════════════
const checkEmail = async (email) => {
  if (!email) throw new Error('กรุณาระบุอีเมล')
  const existing = await PubModel.findByEmail(email)
  if (existing) {
    throw new Error('อีเมลนี้มีในระบบแล้ว กรุณาใช้อีเมลอื่น')
  }
  return true
}

// ════════════════════════════════════════════════════════════════
// getRegistrationStatus — ดึงสถานะการลงทะเบียนของ Pub
//
// ใช้แสดงสถานะบนหน้า View Registration Status
// - pending  = รอ admin ตรวจสอบ
// - approved = อนุมัติแล้ว
// - rejected = ไม่ผ่านการอนุมัติ
// ════════════════════════════════════════════════════════════════
const getRegistrationStatus = async (username) => {
  if (!username || username.trim() === '') {
    throw new Error('กรุณาระบุ username')
  }

  const statusData = await PubModel.findRegistrationStatus(username)

  if (!statusData) {
    throw new Error('ไม่พบข้อมูลผู้ประกอบการนี้')
  }

  return statusData
}

// ════════════════════════════════════════════════════════════════
// getProfile — ดึงข้อมูล Pub profile ทั้งหมด (ยกเว้น password)
// ════════════════════════════════════════════════════════════════
const getProfile = async (username) => {
  if (!username || username.trim() === '') {
    throw new Error('กรุณาระบุ username')
  }

  const profile = await PubModel.findProfileByUsername(username)

  if (!profile) {
    throw new Error('ไม่พบข้อมูลผู้ประกอบการนี้')
  }

  return profile
}

// Export ทั้ง 5 ฟังก์ชันให้ Controller ใช้งาน
module.exports = { registerPub, loginPub, checkEmail, getRegistrationStatus, getProfile }