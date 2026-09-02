const WalletModel = require('../../models/driver/walletModel');

class WalletController {
  static async getBalance(req, res) {
    try {
      const { username } = req.params;
      const balance = await WalletModel.getBalanceByUsername(username);
      
      return res.status(200).json({ balance });
    } catch (error) {
      console.error("Error fetching wallet balance:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTransactions(req, res) {
    try {
      const { username } = req.params;
      const transactions = await WalletModel.getTransactionsByUsername(username);
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async withdraw(req, res) {
    try {
      const { username } = req.params;
      const { amount } = req.body;
      
      if (!amount || isNaN(amount) || Number(amount) < 100) {
        return res.status(400).json({ error: 'จำนวนเงินถอนขั้นต่ำคือ 100 บาท' });
      }

      const result = await WalletModel.withdraw(username, Number(amount));
      return res.status(200).json(result);
    } catch (error) {
      console.error("Error withdrawing:", error);
      if (error.message === "Insufficient balance") {
         return res.status(400).json({ error: "ยอดเงินคงเหลือไม่เพียงพอสำหรับการถอน" });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = WalletController;
