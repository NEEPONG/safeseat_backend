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
      const profileData = { ...req.body };

      // Parse drivercar if it is a JSON string
      if (profileData.drivercar && typeof profileData.drivercar === 'string') {
        try {
          profileData.drivercar = JSON.parse(profileData.drivercar);
        } catch (e) {
          console.error("Error parsing drivercar JSON:", e);
        }
      } else if (!profileData.drivercar) {
        profileData.drivercar = {};
      }

      // Upload files if any
      if (req.files) {
        const { uploadToSupabase, getRelativePath } = require('../../utils/supabaseStorage');
        
        let frontPath = null;
        let sidePath = null;

        if (req.files.frontImage && req.files.frontImage[0]) {
          const uploadedFront = await uploadToSupabase(req.files.frontImage[0], 'images', 'drivers/cars');
          frontPath = getRelativePath(uploadedFront);
        }

        if (req.files.sideImage && req.files.sideImage[0]) {
          const uploadedSide = await uploadToSupabase(req.files.sideImage[0], 'images', 'drivers/cars');
          sidePath = getRelativePath(uploadedSide);
        }

        if (frontPath || sidePath) {
          // Get the current profile to retrieve the existing images
          const currentProfile = await UserModel.getProfileByUsername(username);
          let currentImagePathMap = {};

          if (currentProfile && currentProfile.drivercar && currentProfile.drivercar.carimagepath) {
            try {
              const getCleanRelativePath = (pathStr) => {
                return getRelativePath(pathStr);
              };

              const parsed = JSON.parse(currentProfile.drivercar.carimagepath);
              if (parsed && typeof parsed === 'object') {
                currentImagePathMap = {
                  front: parsed.front ? getCleanRelativePath(parsed.front) : null,
                  side: parsed.side ? getCleanRelativePath(parsed.side) : null,
                };
              }
            } catch (e) {
              // If it's a legacy single string
              currentImagePathMap = {
                front: getRelativePath(currentProfile.drivercar.carimagepath),
                side: null
              };
            }
          }

          if (frontPath) currentImagePathMap.front = frontPath;
          if (sidePath) currentImagePathMap.side = sidePath;

          profileData.drivercar.carimagepath = JSON.stringify(currentImagePathMap);
        }
      }

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
