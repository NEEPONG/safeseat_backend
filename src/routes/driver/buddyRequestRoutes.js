const express = require('express');
const BuddyRequestController = require('../../controllers/driver/buddyRequestController');
const router = express.Router();

router.post('/', BuddyRequestController.send);
router.get('/pending/:userId', BuddyRequestController.getPending);
router.put('/accept/:id', BuddyRequestController.accept);
router.put('/reject/:id', BuddyRequestController.reject);
router.get('/active/:userId', BuddyRequestController.getActive);

module.exports = router;
