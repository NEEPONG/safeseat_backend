const { supabase } = require('../../config/supabase.js');

const getProfile = async (req, res) => {
    try {
        const { phoneNo } = req.params;

        if (!phoneNo) {
            return res.status(400).json({ error: 'Please provide phone number' });
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('phoneno', phoneNo)
            .single();

        if (error || !user) {
            return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้งาน' });
        }

        // ลบรหัสผ่านออกเพื่อความปลอดภัย
        delete user.password;

        return res.status(200).json({
            message: 'Fetch profile successful',
            user: user
        });

    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { phoneno, name, gender, email, mainaddress, profileimagepath } = req.body;

        if (!phoneno) {
            return res.status(400).json({ error: 'Please provide phone number to update' });
        }

        // สร้าง object ข้อมูลที่จะอัปเดต
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (gender !== undefined) updates.gender = parseInt(gender);
        if (email !== undefined) updates.email = email;
        if (mainaddress !== undefined) updates.mainaddress = mainaddress;
        if (profileimagepath !== undefined) updates.profileimagepath = profileimagepath;

        const { data: updatedUser, error } = await supabase
            .from('User')
            .update(updates)
            .eq('phoneno', phoneno)
            .select()
            .single();

        if (error || !updatedUser) {
            console.error("Update error:", error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
        }

        // ลบรหัสผ่านออกก่อนส่งคืน
        delete updatedUser.password;

        return res.status(200).json({
            message: 'Update profile successful',
            user: updatedUser
        });

    } catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getUserCars = async (req, res) => {
    try {
        const { phoneNo } = req.params;
        const { data: cars, error } = await supabase
            .from('usercar')
            .select(`
                *,
                cartype (
                    cartypename
                )
            `)
            .eq('user_id', phoneNo);

        if (error) {
            console.error("Get user cars error:", error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลรถ' });
        }

        return res.status(200).json({
            message: 'Fetch cars successful',
            cars: cars
        });
    } catch (error) {
        console.error("Get user cars error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const getCarTypes = async (req, res) => {
    try {
        const { data: carTypes, error } = await supabase
            .from('cartype')
            .select('*');

        if (error) {
            console.error("Get car types error:", error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรถ' });
        }

        return res.status(200).json({
            message: 'Fetch car types successful',
            carTypes: carTypes
        });
    } catch (error) {
        console.error("Get car types error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const addUserCar = async (req, res) => {
    try {
        const { carbrand, carcolor, carmodel, carplate, car_type, user_id } = req.body;

        if (!carbrand || !carcolor || !carmodel || !carplate || !car_type || !user_id) {
            return res.status(400).json({ error: 'Please provide all required fields' });
        }

        const { data: newCar, error } = await supabase
            .from('usercar')
            .insert([{
                carbrand,
                carcolor,
                carmodel,
                carplate,
                car_type,
                user_id
            }])
            .select(`
                *,
                cartype (
                    cartypename
                )
            `)
            .single();

        if (error) {
            console.error("Add car error:", error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเพิ่มข้อมูลรถ' });
        }

        return res.status(201).json({
            message: 'Add car successful',
            car: newCar
        });
    } catch (error) {
        console.error("Add car error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteUserCar = async (req, res) => {
    try {
        const { usercarid } = req.params;

        const { error } = await supabase
            .from('usercar')
            .delete()
            .eq('usercarid', usercarid);

        if (error) {
            console.error("Delete car error:", error);
            return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูลรถ' });
        }

        return res.status(200).json({
            message: 'Delete car successful'
        });
    } catch (error) {
        console.error("Delete car error:", error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getProfile, updateProfile, getUserCars, getCarTypes, addUserCar, deleteUserCar };
