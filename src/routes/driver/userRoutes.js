const express = require('express');
const UserController = require('../../controllers/driver/userController');

const router = express.Router();

// Route to search users
router.get('/', UserController.searchUsers);

// Route to get a user profile by username (phone)
router.get('/:username', UserController.getProfile);

// Route to update a user profile
router.put('/:username', UserController.updateProfile);

module.exports = router;
