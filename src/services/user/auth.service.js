const { supabase } = require('../../config/supabase.js');
const bcrypt = require('bcrypt');

class AuthService {
    /**
     * Authenticate user with phone number and password.
     * @param {string} phone 
     * @param {string} password 
     * @returns {Promise<object>} Authenticated user profile (without password)
     */
    static async login(phone, password) {
        if (!phone || !password) {
            throw new Error('Please provide both phone and password');
        }

        // ค้นหาผู้ใช้จากฐานข้อมูลด้วยเบอร์โทรศัพท์
        const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('phoneno', phone)
            .single();

        // ถ้าไม่พบผู้ใช้ หรือเกิดข้อผิดพลาด
        if (error || !user) {
            throw new Error('เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
        }

        // เทียบรหัสผ่านแบบ Hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new Error('เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
        }

        // ลบรหัสผ่านออกจาก object ก่อนส่งกลับเพื่อความปลอดภัย
        delete user.password;
        return user;
    }

    /**
     * Register a new user.
     * @param {object} userData 
     * @returns {Promise<void>}
     */
    static async register(userData) {
        const { phone, name, gender, email, password } = userData;

        if (!phone || !name || gender === undefined || !email || !password) {
            throw new Error('Please provide all required fields');
        }

        const passwordRegex = /^[A-Za-z0-9!#_.]{8,16}$/;
        if (!passwordRegex.test(password)) {
            throw new Error('รหัสผ่านไม่ตรงตามเงื่อนไข (ต้องมีความยาว 8-16 ตัวอักษร, ประกอบด้วยภาษาอังกฤษ ตัวเลข หรืออักขระพิเศษ !#_.)');
        }

        const { data: existingUser } = await supabase
            .from('User')
            .select('phoneno')
            .eq('phoneno', phone)
            .single();

        if (existingUser) {
            throw new Error('เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว');
        }

        // เข้ารหัสรหัสผ่านก่อนบันทึก
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { error } = await supabase
            .from('User')
            .insert([
                {
                    phoneno: phone,
                    name: name,
                    gender: parseInt(gender, 10),
                    email: email,
                    password: hashedPassword
                }
            ]);

        if (error) {
            console.error('Insert error:', error);
            throw new Error('เกิดข้อผิดพลาดในการสร้างบัญชี');
        }
    }
}

module.exports = AuthService;
