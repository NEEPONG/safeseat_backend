const { supabase } = require('../../config/supabase.js');
const bcrypt = require('bcrypt');

const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Please provide both phone and password' });
        }

        // ค้นหาผู้ใช้จากฐานข้อมูลด้วยเบอร์โทรศัพท์
        const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('phoneno', phone)
            .single();

        // ถ้าไม่พบผู้ใช้ หรือเกิดข้อผิดพลาด
        if (error || !user) {
            return res.status(401).json({ error: 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // เทียบรหัสผ่านแบบ Hash
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง' });
        }

        // ลบรหัสผ่านออกจาก object ก่อนส่งกลับไปที่หน้าแอป เพื่อความปลอดภัย
        delete user.password;

        return res.status(200).json({
            message: 'Login successful',
            user: user
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};


const register = async (req, res) => {
    try {
        const { phone, name, gender, email, password } = req.body;

        if (!phone || !name || gender === undefined || !email || !password) {
            return res.status(400).json({ error: 'Please provide all required fields' });
        }

        const passwordRegex = /^[A-Za-z0-9!#_.]{8,16}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ error: 'รหัสผ่านไม่ตรงตามเงื่อนไข (ต้องมีความยาว 8-16 ตัวอักษร, ประกอบด้วยภาษาอังกฤษ ตัวเลข หรืออักขระพิเศษ !#_.)' });
        }

        const { data: existingUser } = await supabase
            .from('User')
            .select('phoneno')
            .eq('phoneno', phone)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' });
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
                    gender: parseInt(gender),
                    email: email,
                    password: hashedPassword
                }
            ]);

        if (error) {
            console.error('Insert error:', error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างบัญชี' });
        }

        return res.status(201).json({ message: 'สร้างบัญชีสำเร็จ' });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { login, register };
