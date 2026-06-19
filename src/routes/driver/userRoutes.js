const express = require('express');
const UserController = require('../../controllers/driver/userController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Route to search users
router.get('/', UserController.searchUsers);

// Route to get a user profile by username (phone)
router.get('/:username', UserController.getProfile);

// Route to update a user profile
router.put('/:username', upload.fields([
  { name: 'frontImage', maxCount: 1 },
  { name: 'sideImage', maxCount: 1 }
]), UserController.updateProfile);

module.exports = router;
