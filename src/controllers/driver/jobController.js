const BuddyRequestModel = require('../../models/driver/buddyRequestModel');

class JobController {
  // POST /api/jobs/accept หรือ /api/buddy-team/accept-job
  static async acceptJob(req, res) {
    try {
      const { request_id, buddy_team_id, is_pub_job, isPubJob } = req.body;
      const isPub = (is_pub_job === true || isPubJob === true);
      const job = await BuddyRequestModel.acceptJob(request_id, buddy_team_id, isPub);
      res.status(200).json({ success: true, message: 'รับงานสำเร็จ!', job });
    } catch (error) {
      console.error("Error accepting job:", error);
      res.status(400).json({ success: false, message: error.message || 'Server Error' });
    }
  }

  // POST /api/jobs/complete หรือ /api/buddy-team/complete-job
  static async completeJob(req, res) {
    try {
      const { request_id, buddy_team_id, is_pub_job, isPubJob } = req.body;
      const isPub = (is_pub_job === true || is_pub_job === 'true' || isPubJob === true || isPubJob === 'true');
      
      let evidenceImagePath = null;
      if (req.file) {
        const { uploadToSupabase, getRelativePath } = require('../../utils/supabaseStorage');
        const uploaded = await uploadToSupabase(req.file, 'images', 'requests/evidence');
        evidenceImagePath = getRelativePath(uploaded);
      }

      const result = await BuddyRequestModel.completeJob(request_id, buddy_team_id, isPub, evidenceImagePath);
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      console.error("Error completing job:", error);
      res.status(400).json({ success: false, message: error.message || 'Server Error' });
    }
  }
}

module.exports = JobController;
