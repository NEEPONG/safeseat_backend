const UserModel = require('../../models/driver/userModel');

class UserController {
  // GET /api/users/:username
  static async getProfile(req, res) {
    try {
      const { username } = req.params;
      const profile = await UserModel.getProfileByUsername(username);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json(profile);
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // PUT /api/users/:username
  static async updateProfile(req, res) {
    try {
      const { username } = req.params;
      const profileData = req.body;

      const updatedProfile = await UserModel.updateProfile(username, profileData);

      return res.status(200).json(updatedProfile);
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  // GET /api/users
  static async searchUsers(req, res) {
    try {
      const { search, category, exclude, lat, lng, radius } = req.query;
      const users = await UserModel.searchUsers(search, category, exclude, lat, lng, radius);
      return res.status(200).json(users);
    } catch (error) {
      console.error("Error searching users:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UserController;
