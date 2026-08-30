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
    .select('regisstatus, regisdate, pubname, pubemail, pubphone, pubaddresslat, pubaddresslng, pubopen, pubclose, taxnumber, bankaccountno, bankaccountname, regisimagepath')
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
      'username, pubname, pubemail, pubphone, pubaddresslat, pubaddresslng, ' +
      'pubopen, pubclose, taxnumber, bankaccountno, bankaccountname, ' +
      'regisstatus, regisdate, regisimagepath'
    )
    .eq('username', username)
    .single()

  if (error) return null
  return data
}

// ── Query: ตรวจสอบอีเมลซ้ำข้ามตาราง (pub & driver) ──────────────────────
const checkDuplicateEmailCrossTable = async (email) => {
  if (!email) return false
  const cleanEmail = String(email).trim().toLowerCase()
  const { data: pubData } = await supabase.from('pub').select('pubemail, regisstatus').ilike('pubemail', cleanEmail)
  if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true
  const { data: driverData } = await supabase.from('driver').select('email, registerstatus').ilike('email', cleanEmail)
  if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true
  return false
}

// ── Query: ตรวจสอบเบอร์โทรซ้ำข้ามตาราง (pub & driver) ───────────────────
const checkDuplicatePhoneCrossTable = async (phone) => {
  if (!phone) return false
  const cleanPhone = String(phone).trim()
  const { data: pubData } = await supabase.from('pub').select('pubphone, regisstatus').eq('pubphone', cleanPhone)
  if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true
  const { data: driverData } = await supabase.from('driver').select('phoneno, registerstatus').eq('phoneno', cleanPhone)
  if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true
  return false
}

// ── Query: หา pub จาก taxnumber ─────────────────────────────
const findByTaxNumber = async (taxNumber) => {
  if (!taxNumber) return null
  const cleanTax = String(taxNumber).trim()
  const { data: pubData, error } = await supabase
    .from('pub')
    .select('taxnumber, regisstatus')
    .eq('taxnumber', cleanTax)

  if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) {
    return pubData.find(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')
  }

  const { data: driverData } = await supabase
    .from('driver')
    .select('idcard, registerstatus')
    .eq('idcard', cleanTax)

  if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) {
    return driverData.find(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')
  }

  return null
}

// ── Query: ตรวจสอบเลขบัญชีซ้ำข้ามตาราง (pub & driver) ──────────────────────
const checkDuplicateBankAccountCrossTable = async (bankAccountNo) => {
  if (!bankAccountNo) return false
  const cleanAcc = String(bankAccountNo).trim()
  const { data: pubData } = await supabase.from('pub').select('bankaccountno, regisstatus').eq('bankaccountno', cleanAcc)
  if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true
  const { data: driverData } = await supabase.from('driver').select('bankaccountno, registerstatus').eq('bankaccountno', cleanAcc)
  if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true
  return false
}

// ── Query: หา pub จาก pubname ─────────────────────────────────
const findByPubName = async (pubName) => {
  if (!pubName) return null
  const cleanName = String(pubName).trim()
  const { data, error } = await supabase
    .from('pub')
    .select('pubname, regisstatus')
    .ilike('pubname', cleanName)

  if (error || !data || data.length === 0) return null
  return data.find(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected') || null
}

// ── Query: ตรวจสอบ username ซ้ำข้ามตาราง (pub, driver, admin) ────────────
const checkDuplicateUsernameCrossTable = async (username) => {
  if (!username) return false
  const cleanUser = String(username).trim()
  const { data: pubData } = await supabase
    .from('pub')
    .select('username, regisstatus')
    .eq('username', cleanUser)

  if (pubData && pubData.some(p => p.regisstatus !== 'ปฏิเสธ' && p.regisstatus !== 'rejected')) return true

  const { data: driverData } = await supabase
    .from('driver')
    .select('username, registerstatus')
    .eq('username', cleanUser)

  if (driverData && driverData.some(d => d.registerstatus !== 'ปฏิเสธ' && d.registerstatus !== 'rejected')) return true

  const { data: adminData } = await supabase
    .from('admin')
    .select('username')
    .eq('username', cleanUser)

  if (adminData && adminData.length > 0) return true

  return false
}

module.exports = {
  findByUsername,
  findByEmail,
  findByTaxNumber,
  findByPubName,
  checkDuplicateEmailCrossTable,
  checkDuplicatePhoneCrossTable,
  checkDuplicateBankAccountCrossTable,
  checkDuplicateUsernameCrossTable,
  findRegistrationStatus,
  findProfileByUsername,
  create
}