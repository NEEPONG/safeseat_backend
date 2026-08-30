// ═══════════════════════════════════════════════════════════════
// models/pub/service.model.js
// ═══════════════════════════════════════════════════════════════

const { supabase } = require('../../config/supabase')

/**
 * สร้างรายการเรียกคนขับใหม่ลงในตาราง requestbypub
 */
const createServiceRequest = async (requestData) => {
  const { data, error } = await supabase
    .from('requestbypub')
    .insert(requestData)
    .select()

  if (error) throw error
  return data[0]
}

/**
 * ดึงรายการเรียกคนขับที่ pub นี้เป็นคนสร้าง (เรียงจากใหม่สุดไปเก่าสุด)
 */
const findServiceRequestsByPub = async (username) => {
  const { data, error } = await supabase
    .from('requestbypub')
    .select('*')
    .eq('pub_id', username)
    .order('reqdatetime', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * ดึงข้อมูล request เดียวตาม requestId (สำหรับ polling)
 */
const findServiceRequestById = async (requestId) => {
  const { data, error } = await supabase
    .from('requestbypub')
    .select('*')
    .eq('requestid', requestId)
    .single()

  if (error) throw error
  return data
}

/**
 * ลบรายการเรียกคนขับออกจาก Supabase เมื่อกดยกเลิก
 */
const deleteServiceRequest = async (requestId) => {
  if (!requestId) return null
  // ลบข้อมูลที่เกี่ยวข้องใน servicedetail ถ้ามี
  await supabase.from('servicedetail').delete().eq('requestid', requestId)
  
  const { data, error } = await supabase
    .from('requestbypub')
    .delete()
    .eq('requestid', requestId)
    .select()

  if (error) throw error
  return data
}

module.exports = {
  createServiceRequest,
  findServiceRequestsByPub,
  findServiceRequestById,
  deleteServiceRequest
}

