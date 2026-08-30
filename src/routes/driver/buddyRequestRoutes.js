const express = require('express');
const BuddyRequestController = require('../../controllers/driver/buddyRequestController');
const JobController = require('../../controllers/driver/jobController');
const multer = require('multer');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Buddy Team routes
router.post('/', BuddyRequestController.send);
router.get('/pending/:userId', BuddyRequestController.getPending);
router.put('/accept/:id', BuddyRequestController.accept);
router.put('/reject/:id', BuddyRequestController.reject);
router.get('/active/:userId', BuddyRequestController.getActive);
router.get('/recent/:userId', BuddyRequestController.getRecent);

// Job routes (Backward compatible endpoints)
router.post('/accept-job', JobController.acceptJob);
router.post('/complete-job', upload.single('evidenceImage'), JobController.completeJob);

module.exports = router;

