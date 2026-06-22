const RequestService = require('../../services/user/request.service.js');

class RequestController {
  // POST /api/user/request
  static async createRequest(req, res) {
    try {
      const data = await RequestService.createRequest(req.body);
      return res.status(201).json({
        message: 'Request created successfully',
        request: data,
      });
    } catch (error) {
      console.error("Error in createRequest:", error);
      if (error.message === 'Please provide user_id and user_car_id') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // GET /api/user/request/:id
  static async getRequestStatus(req, res) {
    try {
      const { id } = req.params;
      const request = await RequestService.getRequestStatus(id);
      return res.status(200).json({ request });
    } catch (error) {
      console.error("Error in getRequestStatus:", error);
      if (error.message === 'Request not found') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  // DELETE /api/user/request/:id
  static async cancelRequest(req, res) {
    try {
      const { id } = req.params;
      const data = await RequestService.cancelRequest(id);
      return res.status(200).json({
        message: 'Request canceled (deleted) successfully',
        data: data,
      });
    } catch (error) {
      console.error("Error in cancelRequest:", error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }
}

module.exports = RequestController;

