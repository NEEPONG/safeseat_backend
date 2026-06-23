const BuddyRequestModel = require('../../models/driver/buddyRequestModel');

class BuddyRequestController {
  static async send(req, res) {
    try {
      const { sender_id, receiver_id, lat, lng } = req.body;
      const request = await BuddyRequestModel.sendRequest(sender_id, receiver_id, lat, lng);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error sending request:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getPending(req, res) {
    try {
      const { userId } = req.params;
      const requests = await BuddyRequestModel.getPendingRequests(userId);
      res.status(200).json(requests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async accept(req, res) {
    try {
      const { id } = req.params;
      const result = await BuddyRequestModel.acceptRequest(id);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error accepting request:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async reject(req, res) {
    try {
      const { id } = req.params;
      const result = await BuddyRequestModel.removeRequest(id);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error rejecting request:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async getActive(req, res) {
    try {
      const { userId } = req.params;
      const buddy = await BuddyRequestModel.getActiveBuddy(userId);
      res.status(200).json(buddy);
    } catch (error) {
      console.error("Error fetching active buddy:", error);
      res.status(500).json({ error: error.message });
    }
  }

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

module.exports = BuddyRequestController;
