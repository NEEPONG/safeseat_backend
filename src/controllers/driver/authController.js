const AuthModel = require('../../models/driver/authModel');

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const user = await AuthModel.login(username, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      return res.status(200).json(user);
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}
module.exports = AuthController;
