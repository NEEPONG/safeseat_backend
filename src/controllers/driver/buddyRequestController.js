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
      const { request_id, buddy_team_id } = req.body;
      const job = await BuddyRequestModel.acceptJob(request_id, buddy_team_id);
      res.status(200).json({ success: true, message: 'รับงานสำเร็จ!', job });
    } catch (error) {
      console.error("Error accepting job:", error);
      res.status(400).json({ success: false, message: error.message || 'Server Error' });
    }
  }
}

module.exports = BuddyRequestController;
