// ═══════════════════════════════════════════════════════════════
// controllers/pub/service.controller.js
// ═══════════════════════════════════════════════════════════════

const pubModel = require('../../models/pub/pub.model')
const { createServiceRequest, findServiceRequestsByPub, findServiceRequestById } = require('../../models/pub/service.model')
const { supabase } = require('../../config/supabase')
const DispatcherService = require('../../services/dispatcherService')

/**
 * รับข้อมูลจาก Pub เพื่อเรียกรถให้ลูกค้า
 */
const requestDriver = async (req, res) => {
  try {
    const {
      pubUsername,
      custName,
      phoneNo,
      phoneEmer,
      carType,
      dropoffLatitude,
      dropoffLongitude,
      isLadyMode,
      note,
      paymentMethod
    } = req.body

    // 1. ตรวจสอบข้อมูลบังคับ
    if (!pubUsername || !custName || !phoneNo || !phoneEmer || !carType || !dropoffLatitude || !dropoffLongitude || paymentMethod === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
    }

    // ตรวจสอบความยาวเบอร์โทร
    if (phoneNo.length !== 10 || phoneEmer.length !== 10) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ต้องมี 10 หลัก' })
    }

    // 2. ดึงพิกัดจุดรับ (pickup) จากร้านค้า
    const pubData = await pubModel.findByUsername(pubUsername)
    if (!pubData) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลร้านค้า' })
    }

    const pickupLatitude = pubData.pubaddresslat || pubData.pubAddressLat
    const pickupLongitude = pubData.pubaddresslng || pubData.pubAddressLng

    if (!pickupLatitude || !pickupLongitude) {
      return res.status(400).json({ success: false, message: 'ร้านค้ายังไม่มีการตั้งค่าพิกัดจุดรับ กรุณาตั้งค่า Profile ร้านก่อน' })
    }

    // แปลงประเภทรถเป็น integer ID ของตาราง cartype (1 = EV/Electric, 2 = Manual, 3 = Auto/Autometric)
    let carTypeId = 3
    if (carType === 'Electric' || carType === 'EV') {
      carTypeId = 1
    } else if (carType === 'Manual') {
      carTypeId = 2
    }

    // Fetch driving distance from OSRM
    let dist = 0;
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${parseFloat(pickupLongitude)},${parseFloat(pickupLatitude)};${parseFloat(dropoffLongitude)},${parseFloat(dropoffLatitude)}?overview=false`;
      const response = await fetch(osrmUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          dist = data.routes[0].distance / 1000; // convert meters to km
          console.log(`[OSRM Backend] Distance calculated: ${dist.toFixed(2)} km`);
        } else {
          throw new Error('OSRM returned invalid status or empty routes');
        }
      } else {
        throw new Error(`OSRM API responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('[OSRM Backend Error] Failed to calculate driving distance from OSRM:', error.message);
      return res.status(500).json({ success: false, message: 'ไม่สามารถคำนวณเส้นทางและค่าบริการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' });
    }

    const fee = Math.round(150 + dist * 25)

    // 3. เตรียมข้อมูลที่จะบันทึกลงตาราง requestbypub
    const newRequest = {
      pub_id: pubUsername,
      custname: custName,
      phoneno: phoneNo,
      phoneemer: phoneEmer,
      note: note || '',
      isladymode: isLadyMode || false,
      paymentmethod: parseInt(paymentMethod),
      requeststatus: 'รอคนขับ',
      reqdatetime: new Date().toISOString(),
      requiredcartype: carTypeId,
      pickuplatitude: parseFloat(pickupLatitude),
      pickuplongitude: parseFloat(pickupLongitude),
      dropofflatitude: parseFloat(dropoffLatitude),
      dropofflongitude: parseFloat(dropoffLongitude),
      requestfee: fee,
      reqdistance: dist
    }

    // 4. บันทึกลงฐานข้อมูล
    const createdRequest = await createServiceRequest(newRequest)

    if (!createdRequest) {
      return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง' })
    }

    // ส่งงานกระจายไปยังคนขับในพื้นที่ทันทีโดยไม่ต้องพึ่งพา postgres listener
    DispatcherService.dispatchJob(createdRequest, 'pub').catch(err => {
      console.error('[Dispatcher Error] Direct dispatch failed:', err);
    });

    return res.status(201).json({ success: true, message: 'บันทึกข้อมูลการเรียกใช้บริการสำเร็จ', data: createdRequest })

  } catch (error) {
    console.error('Error in requestDriver:', error)
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเรียกรถ: ' + error.message, error: error.message })
  }
}

/**
 * ดึงข้อมูลประวัติการเรียกรถของ Pub
 */
const getServiceInfo = async (req, res) => {
  try {
    const { username } = req.params

    if (!username) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ pub username' })
    }

    const requests = await findServiceRequestsByPub(username)

    if (!requests || requests.length === 0) {
      return res.status(200).json({ success: true, message: 'ไม่พบรายการข้อมูลการบริการ', data: [] })
    }

    return res.status(200).json({ success: true, data: requests })

  } catch (error) {
    console.error('Error in getServiceInfo:', error)
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลบริการ', error: error.message })
  }
}

/**
 * ดึงข้อมูล request เดียวตาม requestId (สำหรับ polling จากหน้า Waiting)
 */
const getServiceRequestById = async (req, res) => {
  try {
    const { requestId } = req.params
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ requestId' })
    }

    const data = await findServiceRequestById(requestId)
    if (!data) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล request' })
    }

    // หากมี buddy_team_id มอบหมายแล้ว ให้โหลดข้อมูลคนขับ
    if (data.buddy_team_id) {
      const { data: team } = await supabase
        .from('buddyteam')
        .select('*')
        .eq('buddyteamid', data.buddy_team_id)
        .maybeSingle();
      data.buddyteam = team;

      if (team) {
        // ดึงโปรไฟล์หัวหน้าทีมและผู้ช่วย
        const { data: leader } = await supabase
          .from('driver')
          .select('username, firstname, lastname, phone_no, license_plate')
          .eq('username', team.leaderid)
          .maybeSingle();
        const { data: follower } = await supabase
          .from('driver')
          .select('username, firstname, lastname, phone_no')
          .eq('username', team.followerid)
          .maybeSingle();
        data.leader = leader;
        data.follower = follower;
      }
    }

    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Error in getServiceRequestById:', error)
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + error.message })
  }
}

/**
 * จำลองขั้นตอนการเดินทางสำหรับรายการเรียกรถของ Pub
 */
const simulateStep = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { step } = req.body; // step: 1, 2, 3, 4

    if (!requestId || !step) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ requestId และ step' });
    }

    const cleanRequestId = parseInt(requestId, 10);
    const parsedStep = parseInt(step, 10);

    // ดึงข้อมูลรายการเรียกรถเดิม
    const { data: request, error: fetchError } = await supabase
      .from('requestbypub')
      .select('*')
      .eq('requestid', cleanRequestId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!request) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการเรียกรถที่ระบุ' });
    }

    let nextStatus = '';
    let updateFields = {};

    if (parsedStep === 1) {
      nextStatus = 'กำลังไปรับ';
      // ถ้าไม่มี buddy_team_id ให้พยายามหาคู่หูคนขับที่พร้อม (Ready) 1 ทีม หรือใช้ค่า Mock
      let teamId = request.buddy_team_id;
      if (!teamId) {
        const { data: activeTeams } = await supabase
          .from('buddyteam')
          .select('buddyteamid')
          .eq('teamstatus', 'Ready')
          .limit(1);

        if (activeTeams && activeTeams.length > 0) {
          teamId = activeTeams[0].buddyteamid;
        } else {
          // ดึงทีมไหนก็ได้ที่มี หรือ Mock ID 1
          const { data: anyTeams } = await supabase
            .from('buddyteam')
            .select('buddyteamid')
            .limit(1);
          teamId = (anyTeams && anyTeams.length > 0) ? anyTeams[0].buddyteamid : 1;
        }
        
        // อัปเดตสถานะทีมเป็น Busy
        await supabase
          .from('buddyteam')
          .update({ teamstatus: 'Busy' })
          .eq('buddyteamid', teamId);
      }
      updateFields = { requeststatus: nextStatus, buddy_team_id: teamId };
    } else if (parsedStep === 2) {
      nextStatus = 'ถึงจุดรับแล้ว';
      updateFields = { requeststatus: nextStatus };
    } else if (parsedStep === 3) {
      nextStatus = 'ระหว่างเดินทาง';
      updateFields = { requeststatus: nextStatus };
    } else if (parsedStep === 4) {
      nextStatus = 'เสร็จสิ้น';
      updateFields = { requeststatus: nextStatus };
      
      // ปล่อยทีมบัดดี้ให้กลับมา Ready
      if (request.buddy_team_id) {
        await supabase
          .from('buddyteam')
          .update({ teamstatus: 'Ready' })
          .eq('buddyteamid', request.buddy_team_id);
      }
    } else {
      return res.status(400).json({ success: false, message: 'ขั้นตอนไม่ถูกต้อง (ต้องเป็น 1, 2, 3, 4)' });
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from('requestbypub')
      .update(updateFields)
      .eq('requestid', cleanRequestId)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: `จำลองขั้นตอนที่ ${parsedStep} สำเร็จ`,
      data: updatedRequest
    });

  } catch (error) {
    console.error('Error in simulateStep:', error);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการจำลองขั้นตอน: ' + error.message });
  }
};

module.exports = {
  requestDriver,
  getServiceInfo,
  getServiceRequestById,
  simulateStep
}
