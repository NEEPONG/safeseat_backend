// ═══════════════════════════════════════════════════════════════
// models/pub.model.js  —  ติดต่อฐานข้อมูล Supabase โดยตรง
//
// หน้าที่ของ Model:
//  - เขียน query ที่ใช้อ่าน/เขียนข้อมูลในตาราง 'pubs'
//  - ไม่มี business logic (เช่น validation) อยู่ที่นี่
//  - ถ้าต้องการเพิ่ม query ใหม่ เพิ่มที่ไฟล์นี้
//
// ตาราง 'pub' ใน Supabase (PostgreSQL):
//  username, password, pubname, pubemail, pubphone,
//  pubopen, pubclose, pubaddresslat, pubaddresslng,
//  taxnumber, bankaccountno, bankaccountname,
//  regisstatus, regisdate, regisimagepath
// ═══════════════════════════════════════════════════════════════

const { supabase } = require('../../config/supabase')

// ── Query: หา pub จาก username ───────────────────────────────
// ใช้ตอน login และตรวจสอบ username ซ้ำตอนสมัครสมาชิก
// @param username - ชื่อผู้ใช้ที่ต้องการค้นหา
// @returns pub object ถ้าพบ, null ถ้าไม่พบ
const findByUsername = async (username) => {
  const { data, error } = await supabase
    .from('pub')           // ชี้ไปที่ตาราง 'pub'
    .select('*')           // ดึงทุก column
    .eq('username', username) // WHERE username = ?
    .single()              // คืนแถวเดียว (ถ้าไม่เจอจะ error)

  if (error) return null   // ไม่พบ username → คืน null (ไม่ throw)
  return data              // พบ → คืน pub object
}

// ── Query: เพิ่ม pub ใหม่ ─────────────────────────────────────
// ใช้ตอนสมัครสมาชิกสำเร็จ
// @param pubData - object ที่มีข้อมูลทุก field ของ pub
// @returns pub object ที่เพิ่งสร้าง (รวม id และ timestamp)
const create = async (pubData) => {
  const { data, error } = await supabase
    .from('pub')
    .insert(pubData)  // INSERT INTO pub VALUES (...)
    .select()         // ให้คืนแถวที่เพิ่งสร้างกลับมาด้วย

  if (error) throw error  // ถ้า insert ล้มเหลว throw error ให้ service จัดการ
  return data[0]          // คืน pub object แรก (insert ครั้งละ 1 แถว)
}
// ── Query: หา pub จาก email ───────────────────────────────
// ใช้ตอนตรวจสอบอีเมลซ้ำ
// @param email - อีเมลที่ต้องการค้นหา
// @returns pub object ถ้าพบ, null ถ้าไม่พบ
const findByEmail = async (email) => {
  const { data, error } = await supabase
    .from('pub')
    .select('*')
    .eq('pubemail', email)
    .single()

  if (error) return null
  return data
}

// ── Query: ดึงสถานะการลงทะเบียน ────────────────────────────
// ใช้แสดงหน้า View Registration Status
// ดึงเฉพาะ field ที่จำเป็น ไม่ส่ง password กลับ
// @param username - ชื่อผู้ใช้ที่ต้องการดู status
// @returns { regisstatus, regisdate, pubname, pubemail } หรือ null
const findRegistrationStatus = async (username) => {
  const { data, error } = await supabase
    .from('pub')
    .select('regisstatus, regisdate, pubname, pubemail, pubphone, regisimagepath')
    .eq('username', username)
    .single()

  if (error) return null
  return data
}

// ── Query: ดึงข้อมูล profile ของ pub (ไม่รวม password) ──────
// ใช้แสดงข้อมูล pub บนหน้า profile หรือ status page
// @param username - ชื่อผู้ใช้
// @returns pub object ยกเว้น password หรือ null
const findProfileByUsername = async (username) => {
  const { data, error } = await supabase
    .from('pub')
    .select(
      'username, pubname, pubemail, pubphone, pubaddress, pubaddresslat, pubaddresslng, ' +
      'pubopen, pubclose, taxnumber, bankaccountno, bankaccountname, ' +
      'regisstatus, regisdate, regisimagepath'
    )
    .eq('username', username)
    .single()

  if (error) return null
  return data
}

module.exports = { findByUsername, findByEmail, findRegistrationStatus, findProfileByUsername, create }