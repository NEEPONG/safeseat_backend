const express = require('express');
const BuddyRequestController = require('../../controllers/driver/buddyRequestController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', BuddyRequestController.send);
router.get('/pending/:userId', BuddyRequestController.getPending);
router.put('/accept/:id', BuddyRequestController.accept);
router.put('/reject/:id', BuddyRequestController.reject);
router.get('/active/:userId', BuddyRequestController.getActive);
router.post('/accept-job', BuddyRequestController.acceptJob);
router.post('/complete-job', upload.single('evidenceImage'), BuddyRequestController.completeJob);

module.exports = router;
