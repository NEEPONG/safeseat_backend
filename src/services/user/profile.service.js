const { supabase } = require('../../config/supabase.js');

class ProfileService {
    /**
     * Get user profile by phone number.
     * @param {string} phoneNo 
     * @returns {Promise<object>} User profile (without password)
     */
    static async getProfile(phoneNo) {
        if (!phoneNo) {
            throw new Error('Please provide phone number');
        }

        const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('phoneno', phoneNo)
            .single();

        if (error || !user) {
            throw new Error('ไม่พบข้อมูลผู้ใช้งาน');
        }

        delete user.password;
        return user;
    }

    /**
     * Update user profile fields.
     * @param {string} phone 
     * @param {object} updates 
     * @returns {Promise<object>} Updated user profile (without password)
     */
    static async updateProfile(phone, fieldsToUpdate) {
        if (!phone) {
            throw new Error('Please provide phone number to update');
        }

        const updates = {};
        if (fieldsToUpdate.name !== undefined) updates.name = fieldsToUpdate.name;
        if (fieldsToUpdate.gender !== undefined) updates.gender = parseInt(fieldsToUpdate.gender, 10);
        if (fieldsToUpdate.email !== undefined) updates.email = fieldsToUpdate.email;
        if (fieldsToUpdate.mainaddress !== undefined) updates.mainaddress = fieldsToUpdate.mainaddress;
        if (fieldsToUpdate.profileimagepath !== undefined) updates.profileimagepath = fieldsToUpdate.profileimagepath;

        const { data: updatedUser, error } = await supabase
            .from('User')
            .update(updates)
            .eq('phoneno', phone)
            .select()
            .single();

        if (error || !updatedUser) {
            console.error("Update error:", error);
            throw new Error('เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์');
        }

        delete updatedUser.password;
        return updatedUser;
    }

    /**
     * Get cars registered to the user.
     * @param {string} phoneNo 
     * @returns {Promise<Array>} List of cars
     */
    static async getUserCars(phoneNo) {
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
            throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูลรถ');
        }

        return cars;
    }

    /**
     * Get all available car types.
     * @returns {Promise<Array>} List of car types
     */
    static async getCarTypes() {
        const { data: carTypes, error } = await supabase
            .from('cartype')
            .select('*');

        if (error) {
            console.error("Get car types error:", error);
            throw new Error('เกิดข้อผิดพลาดในการดึงข้อมูลประเภทรถ');
        }

        return carTypes;
    }

    /**
     * Add a new vehicle to the user's profile.
     * @param {object} carData 
     * @returns {Promise<object>} Registered car data
     */
    static async addUserCar(carData) {
        const { carbrand, carcolor, carmodel, carplate, car_type, user_id } = carData;

        if (!carbrand || !carcolor || !carmodel || !carplate || !car_type || !user_id) {
            throw new Error('Please provide all required fields');
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
            throw new Error('เกิดข้อผิดพลาดในการเพิ่มข้อมูลรถ');
        }

        return newCar;
    }

    /**
     * Delete user car by ID.
     * @param {string|number} usercarid 
     * @returns {Promise<void>}
     */
    static async deleteUserCar(usercarid) {
        const { error } = await supabase
            .from('usercar')
            .delete()
            .eq('usercarid', usercarid);

        if (error) {
            console.error("Delete car error:", error);
            throw new Error('เกิดข้อผิดพลาดในการลบข้อมูลรถ');
        }
    }
}

module.exports = ProfileService;
