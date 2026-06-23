const ProfileService = require('../../services/user/profile.service.js');

const getProfile = async (req, res) => {
    try {
        const { phoneNo } = req.params;
        const user = await ProfileService.getProfile(phoneNo);
        return res.status(200).json({
            message: 'Fetch profile successful',
            user: user
        });
    } catch (error) {
        console.error("Get profile error:", error);
        if (error.message === 'Please provide phone number') {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === 'ไม่พบข้อมูลผู้ใช้งาน') {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { phoneno, name, gender, email, mainaddress, profileimagepath } = req.body;
        const updatedUser = await ProfileService.updateProfile(phoneno, {
            name,
            gender,
            email,
            mainaddress,
            profileimagepath
        });
        return res.status(200).json({
            message: 'Update profile successful',
            user: updatedUser
        });
    } catch (error) {
        console.error("Update profile error:", error);
        if (error.message === 'Please provide phone number to update') {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const getUserCars = async (req, res) => {
    try {
        const { phoneNo } = req.params;
        const cars = await ProfileService.getUserCars(phoneNo);
        return res.status(200).json({
            message: 'Fetch cars successful',
            cars: cars
        });
    } catch (error) {
        console.error("Get user cars error:", error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const getCarTypes = async (req, res) => {
    try {
        const carTypes = await ProfileService.getCarTypes();
        return res.status(200).json({
            message: 'Fetch car types successful',
            carTypes: carTypes
        });
    } catch (error) {
        console.error("Get car types error:", error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const addUserCar = async (req, res) => {
    try {
        const newCar = await ProfileService.addUserCar(req.body);
        return res.status(201).json({
            message: 'Add car successful',
            car: newCar
        });
    } catch (error) {
        console.error("Add car error:", error);
        if (error.message === 'Please provide all required fields') {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

const deleteUserCar = async (req, res) => {
    try {
        const { usercarid } = req.params;
        await ProfileService.deleteUserCar(usercarid);
        return res.status(200).json({
            message: 'Delete car successful'
        });
    } catch (error) {
        console.error("Delete car error:", error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
};

module.exports = { getProfile, updateProfile, getUserCars, getCarTypes, addUserCar, deleteUserCar };

