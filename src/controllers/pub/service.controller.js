// ═══════════════════════════════════════════════════════════════
// controllers/pub/service.controller.js
// ═══════════════════════════════════════════════════════════════

const pubModel = require('../../models/pub/pub.model')
const { createServiceRequest, findServiceRequestsByPub, findServiceRequestById, deleteServiceRequest } = require('../../models/pub/service.model')
const { supabase } = require('../../config/supabase')
const DispatcherService = require('../../services/dispatcherService')

/**
 * ฟังก์ชันสร้าง Timestamp เวลาปัจจุบันของประเทศไทย (UTC+7 / Asia/Bangkok)
 */
function getThaiCurrentISOString() {
  const now = new Date()
  const thaiDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
  const thaiTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false })
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${thaiDateStr}T${thaiTimeStr}.${ms}`
}

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
      carModel,
      carmodel,
      licensePlate,
      carplate,
      dropoffLatitude,
      dropoffLongitude,
      isLadyMode,
      note,
      paymentMethod
    } = req.body

    const carModelVal = (carModel || carmodel || '').trim()
    const licensePlateVal = (licensePlate || carplate || '').trim()

    // 1. ตรวจสอบข้อมูลบังคับ
    if (!pubUsername || !custName || !phoneNo || !phoneEmer || !carType || !dropoffLatitude || !dropoffLongitude || paymentMethod === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
    }

    // ตรวจสอบความยาวเบอร์โทร
    if (phoneNo.length !== 10 || phoneEmer.length !== 10) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ต้องมี 10 หลัก' })
    }

    if (phoneNo.trim() === phoneEmer.trim()) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรศัพท์ของลูกค้าและเบอร์โทรฉุกเฉินต้องห้ามซ้ำกัน' })
    }

    // 2. ดึงพิกัดจุดรับ (pickup) จากสถานบันเทิง
    const pubData = await pubModel.findByUsername(pubUsername)
    if (!pubData) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสถานบันเทิง' })
    }

    const pickupLatitude = pubData.pubaddresslat || pubData.pubAddressLat
    const pickupLongitude = pubData.pubaddresslng || pubData.pubAddressLng

    if (!pickupLatitude || !pickupLongitude) {
      return res.status(400).json({ success: false, message: 'สถานบันเทิงยังไม่มีการตั้งค่าพิกัดจุดรับ กรุณาตั้งค่า Profile สถานบันเทิงก่อน' })
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

    const fee = Math.round(300 + dist * 10)

    const dropoffNameVal = (req.body.dropoffName || req.body.dropoffname || req.body.dropoffLabel || '').trim()

    // note เก็บเฉพาะข้อความที่ผู้ใช้พิมพ์มาเท่านั้น ถ้าไม่มีให้เป็น null
    const userNote = (note || '').trim() || null

    // 3. เตรียมข้อมูลที่จะบันทึกลงตาราง requestbypub
    // ไม่บันทึก dropoffname ลง DB (ไม่มี column) — ส่งกลับผ่าน response เท่านั้น
    // frontend เก็บชื่อจุดหมายปลายทางใน localStorage เอง
    const newRequest = {
      pub_id: pubUsername,
      custname: custName,
      phoneno: phoneNo,
      phoneemer: phoneEmer,
      carmodel: carModelVal,
      carplate: licensePlateVal,
      note: userNote,   // เฉพาะข้อความจากผู้ใช้ ไม่มี metadata tags ใดๆ
      isladymode: isLadyMode || false,
      paymentmethod: parseInt(paymentMethod),
      requeststatus: 'รอคนขับ',
      reqdatetime: getThaiCurrentISOString(),
      requiredcartype: carTypeId,
      pickuplatitude: parseFloat(pickupLatitude),
      pickuplongitude: parseFloat(pickupLongitude),
      dropofflatitude: parseFloat(dropoffLatitude),
      dropofflongitude: parseFloat(dropoffLongitude),
      requestfee: fee,
      reqdistance: dist
    }

    // 4. บันทึกลงฐานข้อมูล (ลองใส่ carmodel/carplate ก่อน fallback ถ้าไม่มี column)
    let createdRequest = null
    try {
      createdRequest = await createServiceRequest(newRequest)
    } catch (dbErr) {
      console.warn('[requestDriver Warning] Failed with carmodel/carplate, trying fallback:', dbErr.message)
      const req1 = { ...newRequest }
      delete req1.carmodel
      delete req1.carplate
      createdRequest = await createServiceRequest(req1)
    }

    if (!createdRequest) {
      return res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง' })
    }

    // แนบ carmodel, carplate และ dropoffname กลับใน response
    // (ไม่ได้เก็บใน DB แต่ frontend ต้องการเพื่อบันทึกลง localStorage)
    createdRequest.carmodel = carModelVal
    createdRequest.carplate = licensePlateVal
    if (dropoffNameVal) {
      createdRequest.dropoffname = dropoffNameVal
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
 * Helper สกัด carmodel และ carplate จาก note หากใน DB ไม่มี column
 */
const extractCarInfoFromNote = (item) => {
  if (!item) return item
  if (!item.carmodel || !item.carplate) {
    if (item.note) {
      const match = item.note.match(/\[รุ่นรถ:\s*(.*?)\s*\|\s*ทะเบียน:\s*(.*?)\]/)
      if (match) {
        if (!item.carmodel) item.carmodel = match[1] !== '-' ? match[1] : ''
        if (!item.carplate) item.carplate = match[2] !== '-' ? match[2] : ''
      }
    }
  }
  return item
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

    const formattedRequests = await Promise.all(
      requests.map(r => populateDriverTeamInfo(r))
    )

    return res.status(200).json({ success: true, data: formattedRequests })

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
    const targetType = req.query.type // 'user' or 'pub'

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ requestId' })
    }

    // Helper function to query requestbyuser
    const queryUserRequest = async () => {
      const { data: userReq, error: userReqErr } = await supabase
        .from('requestbyuser')
        .select('*')
        .eq('requestid', parseInt(requestId, 10))
        .maybeSingle()

      if (userReqErr) {
        console.error('Error fetching requestbyuser:', userReqErr)
      }

      if (userReq) {
        let custName = 'ลูกค้า SafeSeat'
        try {
          const { data: userProfile } = await supabase
            .from('User')
            .select('name')
            .eq('phoneno', userReq.user_id)
            .maybeSingle()
          if (userProfile && userProfile.name) {
            custName = userProfile.name
          }
        } catch (errProfile) {
          console.warn("Could not load user name for requestbyuser fallback", errProfile)
        }

        return {
          requestid: userReq.requestid,
          custname: custName,
          phoneno: userReq.user_id,
          phoneemer: '',
          note: userReq.note || '',
          isladymode: userReq.isladymode,
          paymentmethod: userReq.paymentmethod,
          requeststatus: userReq.requeststatus,
          reqdatetime: userReq.created_at || getThaiCurrentISOString(),
          requiredcartype: 3, // ค่า Default เป็น Auto
          pickuplatitude: userReq.pickuplatitude,
          pickuplongitude: userReq.pickuplongitude,
          dropofflatitude: userReq.dropofflatitude,
          dropofflongitude: userReq.dropofflongitude,
          requestfee: userReq.requestfee,
          reqdistance: userReq.reqdistance,
          buddy_team_id: userReq.buddy_team_id,
          requestType: 'user'
        }
      }
      return null
    }

    // Helper function to query requestbypub
    const queryPubRequest = async () => {
      try {
        const pubReq = await findServiceRequestById(requestId)
        if (pubReq) {
          pubReq.requestType = 'pub'
          return pubReq
        }
      } catch (e) {
        // ไม่พบในตาราง requestbypub
      }
      return null
    }

    // If explicit type requested (from choice click)
    if (targetType === 'user') {
      const uData = await queryUserRequest()
      if (!uData) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล request' })
      return processAndReturnRequest(uData, res)
    } else if (targetType === 'pub') {
      const pData = await queryPubRequest()
      if (!pData) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล request' })
      return processAndReturnRequest(pData, res)
    }

    // Otherwise check both tables to handle duplicate ID collisions
    const [userResult, pubResult] = await Promise.all([queryUserRequest(), queryPubRequest()])

    if (userResult && pubResult) {
      // Duplicate ID detected in BOTH tables! Return multiple options for user choice.
      return res.status(200).json({
        success: true,
        isMultiple: true,
        matches: [userResult, pubResult]
      })
    }

    const data = userResult || pubResult
    if (!data) {
      return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล request' })
    }

    return processAndReturnRequest(data, res)
  } catch (error) {
    console.error('Error in getServiceRequestById:', error)
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + error.message })
  }
}

// Helper to populate driver team info and pub details
const populateDriverTeamInfo = async (dataInput) => {
  if (!dataInput) return dataInput
  let data = extractCarInfoFromNote(dataInput)

  // Parse [DEST:] จาก note ของ records เก่า (สำหรับ backward compatibility)
  if (data && data.note && data.note.includes('[DEST:')) {
    const destMatch = data.note.match(/\[DEST:(.*?)\]/)
    if (destMatch && destMatch[1]) {
      data.dropoffname = destMatch[1].trim()
      data.destination_name = destMatch[1].trim()
    }
  }

  // Clean note: ลบ metadata tags ทั้งหมดออกก่อนส่งกลับ frontend
  // ทำให้ note ที่ frontend เห็นเป็นเฉพาะข้อความผู้ใช้เท่านั้น
  if (data && data.note) {
    const cleanedNote = data.note
      .replace(/\[รุ่นรถ:\s*.*?\|\s*ทะเบียน:\s*.*?\]/g, '')
      .replace(/\[DEST:.*?\]/g, '')
      .trim()
    data.note = cleanedNote || null
  }

  if (data.pub_id) {
    try {
      const { data: pubRow } = await supabase
        .from('pub')
        .select('username, pubname, pubaddress, pubphone, pubemail')
        .eq('username', data.pub_id)
        .maybeSingle()
      if (pubRow) {
        data.pub = pubRow
      }
    } catch (e) {
      console.warn("Could not fetch pub details:", e)
    }
  }

  const buddyTeamId = data.buddy_team_id || data.buddyteamid || data.buddyteam_id
  if (buddyTeamId) {
    try {
      const teamIdNum = parseInt(buddyTeamId, 10)
      const { data: team } = await supabase
        .from('buddyteam')
        .select('*')
        .eq('buddyteamid', teamIdNum)
        .maybeSingle()
      data.buddyteam = team
      data.buddy_team_id = teamIdNum

      if (team) {
        let leaderRow = null
        if (team.leaderid) {
          const { data: lRow } = await supabase
            .from('driver')
            .select('username, firstname, lastname, phoneno')
            .eq('username', team.leaderid)
            .maybeSingle()
          leaderRow = lRow
        }

        let carPlate = '—'
        if (team.leaderid) {
          try {
            const { data: carRow } = await supabase
              .from('driver_car')
              .select('carplate')
              .eq('username', team.leaderid)
              .maybeSingle()
            if (carRow && carRow.carplate) {
              carPlate = carRow.carplate
            }
          } catch (carErr) {
            console.warn("Could not load car plate for leader", carErr)
          }
        }

        let followerRow = null
        if (team.followerid) {
          const { data: fRow } = await supabase
            .from('driver')
            .select('username, firstname, lastname, phoneno')
            .eq('username', team.followerid)
            .maybeSingle()
          followerRow = fRow
        }

        if (leaderRow) {
          data.leader = {
            firstname: leaderRow.firstname,
            lastname: leaderRow.lastname,
            phoneno: leaderRow.phoneno,
            phone_no: leaderRow.phoneno,
            phone: leaderRow.phoneno,
            license_plate: carPlate
          }
        } else {
          data.leader = null
        }

        if (followerRow) {
          data.follower = {
            firstname: followerRow.firstname,
            lastname: followerRow.lastname,
            phoneno: followerRow.phoneno,
            phone_no: followerRow.phoneno,
            phone: followerRow.phoneno
          }
        } else {
          data.follower = null
        }
      }
    } catch (teamErr) {
      console.error("Error populating driver team info:", teamErr)
    }
  }

  return data
}

const processAndReturnRequest = async (dataInput, res) => {
  const data = await populateDriverTeamInfo(dataInput)
  return res.status(200).json({ success: true, isMultiple: false, data })
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
        // ดึงทีมที่ว่างและตรวจสอบเพศรองรับ Lady Mode
        const { data: activeTeams } = await supabase
          .from('buddyteam')
          .select('*, leader:leaderid(gender), follower:followerid(gender)')
          .eq('teamstatus', 'Ready');

        let eligibleTeams = activeTeams || [];
        const isFemale = (g) => g === 2 || g === '2' || String(g).toLowerCase() === 'female' || String(g) === 'หญิง';
        if (request.isladymode) {
          eligibleTeams = eligibleTeams.filter(team => {
            return team.leader && isFemale(team.leader.gender) && team.follower && isFemale(team.follower.gender);
          });
        }

        if (eligibleTeams && eligibleTeams.length > 0) {
          teamId = eligibleTeams[0].buddyteamid;
        } else {
          // ดึงทีมไหนก็ได้ที่มี หรือ Mock ID 1
          const { data: anyTeams } = await supabase
            .from('buddyteam')
            .select('*, leader:leaderid(gender), follower:followerid(gender)');
          
          let eligibleAnyTeams = anyTeams || [];
          if (request.isladymode) {
            eligibleAnyTeams = eligibleAnyTeams.filter(team => {
              return team.leader && isFemale(team.leader.gender) && team.follower && isFemale(team.follower.gender);
            });
          }
          teamId = (eligibleAnyTeams && eligibleAnyTeams.length > 0) ? eligibleAnyTeams[0].buddyteamid : 1;
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

/**
 * ยกเลิกและลบรายการเรียกรถของ Pub ออกจากฐานข้อมูลแบบสมบูรณ์
 */
const cancelServiceRequest = async (req, res) => {
  try {
    const { requestId } = req.params
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ requestId' })
    }

    const cleanId = parseInt(requestId, 10)
    await Promise.all([
      deleteServiceRequest(requestId),
      supabase.from('requestbypub').delete().eq('requestid', cleanId),
      supabase.from('requestbyuser').delete().eq('requestid', cleanId)
    ])

    return res.json({ success: true, message: 'ยกเลิกและลบข้อมูลการเรียกรถออกจากระบบเรียบร้อยแล้ว' })
  } catch (err) {
    console.error('Error in cancelServiceRequest:', err)
    return res.status(500).json({ success: false, message: 'ไม่สามารถลบข้อมูลการเรียกรถได้: ' + err.message })
  }
}

module.exports = {
  requestDriver,
  getServiceInfo,
  getServiceRequestById,
  simulateStep,
  cancelServiceRequest
}
