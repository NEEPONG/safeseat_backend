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
  // Purge any cancelled requests from DB so cancelled data is no longer stored
  try {
    await supabase
      .from('requestbypub')
      .delete()
      .eq('pub_id', username)
      .in('requeststatus', ['cancelled', 'ยกเลิก', 'ปฏิเสธ', 'rejected']);
  } catch (e) {
    console.warn('Error purging cancelled requests:', e);
  }

  const { data, error } = await supabase
    .from('requestbypub')
    .select('*')
    .eq('pub_id', username)
    .not('requeststatus', 'in', '("cancelled","ยกเลิก","ปฏิเสธ","rejected")')
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
 * ลบรายการเรียกคนขับออกจากตาราง requestbypub (เมื่อยกเลิกการค้นหา)
 */
const deleteServiceRequest = async (requestId) => {
  const { data, error } = await supabase
    .from('requestbypub')
    .delete()
    .eq('requestid', parseInt(requestId, 10))
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

