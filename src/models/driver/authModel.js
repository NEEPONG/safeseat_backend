const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');
const bcrypt = require('bcrypt');

class AuthModel {
  static async login(username, password, latitude, longitude) {
    let { data, error } = await supabase
      .from('driver')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const isMatch = await bcrypt.compare(password, data.password);
    if (!isMatch) return null;

    // ตรวจสอบสถานะการอนุมัติการสมัคร (registerstatus)
    const status = data.registerstatus;
    if (status === 'รอดำเนินการ' || status === 'pending') {
      return { status: 'PENDING', registerstatus: status };
    }
    if (status === 'ปฏิเสธ' || status === 'rejected') {
      return { status: 'REJECTED', registerstatus: status };
    }
    if (status !== 'อนุมัติแล้ว' && status !== 'approved') {
      return { status: 'NOT_APPROVED', registerstatus: status };
    }

    // หากเข้าสู่ระบบสำเร็จและมีการส่งพิกัดละติจูด/ลองจิจูดมา ให้ทำการอัปเดตตำแหน่งคนขับ
    if (data && latitude !== undefined && longitude !== undefined) {
      const { data: updatedData, error: updateError } = await supabase
        .from('driver')
        .update({ latitude, longitude })
        .eq('username', username)
        .select('*')
        .maybeSingle();
      
      if (!updateError && updatedData) {
        data = updatedData;
      }
    }

    return { status: 'APPROVED', user: formatDriverDocs(data) };
  }

  // ตรวจสอบว่ามี username นี้อยู่ในระบบแล้วหรือยัง (ยกเว้นผู้ที่ถูกปฏิเสธ)
  static async checkDuplicateUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('username, registerstatus')
      .eq('username', username)
      .maybeSingle();

    if (error || !data) return false;
    if (data.registerstatus === 'ปฏิเสธ' || data.registerstatus === 'rejected') return false;
    return true;
  }

  // ดึงสถานะการสมัครสมาชิกของคนขับ
  static async getStatus(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('registerstatus, regisdate, firstname, lastname, email, phoneno')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Check if email already exists in driver or pub (excluding rejected)
  static async checkDuplicateEmail(email) {
    if (!email) return false;
    const { data: driverData } = await supabase
      .from('driver')
      .select('email, registerstatus')
      .eq('email', email)
      .maybeSingle();

    if (driverData && driverData.registerstatus !== 'ปฏิเสธ' && driverData.registerstatus !== 'rejected') return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubemail, regisstatus')
      .eq('pubemail', email)
      .maybeSingle();

    if (pubData && pubData.regisstatus !== 'ปฏิเสธ' && pubData.regisstatus !== 'rejected') return true;

    return false;
  }

  // Check if phone number already exists in driver or pub (excluding rejected)
  static async checkDuplicatePhone(phoneno) {
    if (!phoneno) return false;
    const { data: driverData } = await supabase
      .from('driver')
      .select('phoneno, registerstatus')
      .eq('phoneno', phoneno)
      .maybeSingle();

    if (driverData && driverData.registerstatus !== 'ปฏิเสธ' && driverData.registerstatus !== 'rejected') return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubphone, regisstatus')
      .eq('pubphone', phoneno)
      .maybeSingle();

    if (pubData && pubData.regisstatus !== 'ปฏิเสธ' && pubData.regisstatus !== 'rejected') return true;

    return false;
  }

  // ตรวจสอบว่ามีเลขบัตรประชาชนนี้อยู่ในระบบแล้วหรือยัง (excluding rejected)
  static async checkDuplicateIdCard(idcard) {
    const { data, error } = await supabase
      .from('driver')
      .select('idcard, registerstatus')
      .eq('idcard', idcard)
      .maybeSingle();

    if (error || !data) return false;
    if (data.registerstatus === 'ปฏิเสธ' || data.registerstatus === 'rejected') return false;
    return true;
  }

  // ตรวจสอบว่ามีทะเบียนยานพาหนะนี้อยู่ในระบบแล้วหรือยัง (Normalized เปรียบเทียบ)
  static async checkDuplicateCarPlate(carPlate) {
    if (!carPlate) return false;
    const cleanInput = String(carPlate).replace(/[\s-]/g, '').toLowerCase();
    const { data, error } = await supabase
      .from('drivercar')
      .select('carplate');

    if (error || !data) return false;
    return data.some(c => c.carplate && String(c.carplate).replace(/[\s-]/g, '').toLowerCase() === cleanInput);
  }

  // สมัครสมาชิกคนขับพร้อมทั้งลงทะเบียนข้อมูลรถยนต์
  static async register(driverData, carData) {
    // 0. ตรวจสอบว่าเดิมมีบัญชีที่เคยถูกปฏิเสธอยู่หรือไม่ -> ถ้ามีให้ทำการอัปเดตแทนการ insert ใหม่
    const { data: existingDriver } = await supabase
      .from('driver')
      .select('username, driver_car, registerstatus')
      .eq('username', driverData.username)
      .maybeSingle();

    if (existingDriver) {
      if (existingDriver.driver_car) {
        await supabase
          .from('drivercar')
          .update(carData)
          .eq('drivercarid', existingDriver.driver_car);
      }
      const { data: updatedDriver, error: driverErr } = await supabase
        .from('driver')
        .update({
          ...driverData,
          registerstatus: 'รอดำเนินการ',
          regisdate: new Date().toISOString()
        })
        .eq('username', driverData.username)
        .select()
        .maybeSingle();

      if (driverErr) {
        console.error("Error resubmitting driver:", driverErr);
        throw new Error(`ไม่สามารถอัปเดตข้อมูลการสมัครได้: ${driverErr.message}`);
      }

      return {
        driver: updatedDriver,
        car: carData
      };
    }

    // 1. เพิ่มข้อมูลรถยนต์ของคนขับใหม่
    const { data: insertedCar, error: carError } = await supabase
      .from('drivercar')
      .insert([carData])
      .select()
      .maybeSingle();

    if (carError) {
      console.error("Error inserting driver car:", carError);
      throw new Error(`ไม่สามารถบันทึกข้อมูลรถยนต์ได้: ${carError.message}`);
    }

    if (!insertedCar) {
      throw new Error("เกิดข้อผิดพลาดในการบันทึกข้อมูลรถยนต์");
    }

    // 2. เพิ่มข้อมูลคนขับโดยเชื่อมโยงไอดีรถยนต์ที่เพิ่งเพิ่มเข้าไป
    const driverRecord = {
      ...driverData,
      driver_car: insertedCar.drivercarid
    };

    const { data: insertedDriver, error: driverError } = await supabase
      .from('driver')
      .insert([driverRecord])
      .select()
      .maybeSingle();

    if (driverError) {
      console.error("Error inserting driver:", driverError);
      // พยายามลบข้อมูลรถยนต์ที่เพิ่งเพิ่มเข้าไปเพื่อป้องกันข้อมูลขยะหากการสมัครสมาชิกคนขับล้มเหลว
      try {
        await supabase
          .from('drivercar')
          .delete()
          .eq('drivercarid', insertedCar.drivercarid);
      } catch (cleanupError) {
        console.error("Failed to clean up car record after driver insert error:", cleanupError);
      }
      throw new Error(`ไม่สามารถสมัครสมาชิกได้: ${driverError.message}`);
    }

    return {
      driver: insertedDriver,
      car: insertedCar
    };
  }
}

module.exports = AuthModel;

