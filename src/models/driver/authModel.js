const supabase = require('./dbClient');
const { formatDriverDocs } = require('../../utils/supabaseStorage');

class AuthModel {
  static async login(username, password) {
    const { data, error } = await supabase
      .from('driver')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .eq('registerstatus', 'อนุมัติแล้ว')
      .maybeSingle();

    if (error) throw error;
    return formatDriverDocs(data);
  }

  // Check if username already exists
  static async checkDuplicateUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('username')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  // Check if email already exists
  static async checkDuplicateEmail(email) {
    const { data, error } = await supabase
      .from('driver')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  // Check if phone number already exists
  static async checkDuplicatePhone(phoneno) {
    const { data, error } = await supabase
      .from('driver')
      .select('phoneno')
      .eq('phoneno', phoneno)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  // Register driver and their car
  static async register(driverData, carData) {
    // 1. Insert car information first
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

    // 2. Insert driver information, linking to the newly inserted car ID
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
      // Attempt to clean up the inserted car to maintain data integrity
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

