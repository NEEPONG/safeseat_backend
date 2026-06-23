const AuthService = require('../../services/user/auth.service.js');

const login = async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await AuthService.login(phone, password);
        return res.status(200).json({
            message: 'Login successful',
            user: user
        });
    } catch (error) {
        console.error("Login error:", error);
        if (error.message === 'Please provide both phone and password') {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง') {
            return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const register = async (req, res) => {
    try {
        await AuthService.register(req.body);
        return res.status(201).json({ message: 'สร้างบัญชีสำเร็จ' });
    } catch (error) {
        console.error('Register error:', error);
        if (
            error.message === 'Please provide all required fields' ||
            error.message.includes('รหัสผ่านไม่ตรงตามเงื่อนไข') ||
            error.message === 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว'
        ) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

module.exports = { login, register };

