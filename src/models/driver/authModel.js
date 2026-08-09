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

    return formatDriverDocs(data);
  }

  // ตรวจสอบว่ามี username นี้อยู่ในระบบแล้วหรือยัง
  static async checkDuplicateUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return !!data;
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

  // Check if email already exists in driver or pub
  static async checkDuplicateEmail(email) {
    if (!email) return false;
    const { data: driverData } = await supabase
      .from('driver')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (driverData) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubemail')
      .eq('pubemail', email)
      .maybeSingle();

    return !!pubData;
  }

  // Check if phone number already exists in driver or pub
  static async checkDuplicatePhone(phoneno) {
    if (!phoneno) return false;
    const { data: driverData } = await supabase
      .from('driver')
      .select('phoneno')
      .eq('phoneno', phoneno)
      .maybeSingle();

    if (driverData) return true;

    const { data: pubData } = await supabase
      .from('pub')
      .select('pubphone')
      .eq('pubphone', phoneno)
      .maybeSingle();

    return !!pubData;
  }

  // ตรวจสอบว่ามีเลขบัตรประชาชนนี้อยู่ในระบบแล้วหรือยัง
  static async checkDuplicateIdCard(idcard) {
    const { data, error } = await supabase
      .from('driver')
      .select('idcard')
      .eq('idcard', idcard)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  // สมัครสมาชิกคนขับพร้อมทั้งลงทะเบียนข้อมูลรถยนต์
  static async register(driverData, carData) {
    // 1. เพิ่มข้อมูลรถยนต์ของคนขับก่อน
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

