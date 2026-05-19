const express = require('express');
const WalletController = require('../../controllers/driver/walletController');

const router = express.Router();

// Route to get wallet balance by username (phone)
router.get('/:username/balance', WalletController.getBalance);

// Route to get transactions by username
router.get('/:username/transactions', WalletController.getTransactions);

// Route to withdraw money
router.post('/:username/withdraw', WalletController.withdraw);

module.exports = router;
