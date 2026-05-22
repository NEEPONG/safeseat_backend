const supabase = require('./dbClient');

class WalletModel {
  static async getBalanceByUsername(username) {
    const { data, error } = await supabase
      .from('driver')
      .select('walletbalance')
      .eq('username', username)
      .single();

    if (error) {
      throw error;
    }
    
    return data.walletbalance || 0;
  }

  static async getTransactionsByUsername(username) {
    // Fetch transactions for driver
    const { data: transactions, error: txError } = await supabase
        .from('driverwallettransaction')
        .select('*')
        .eq('driver_id', username)
        .order('trandate', { ascending: false });

    if (txError) throw txError;
    
    // Map to mobile app's expected format
    return transactions.map(tx => ({
        id: tx.tranid,
        type: tx.trantype.toLowerCase() === 'withdraw' ? 'withdraw' : 'topup',
        created_at: tx.trandate,
        amount: tx.amount,
        status: tx.transtatus.toLowerCase() === 'success' ? 'success' : 'pending'
    }));
  }

  static async withdraw(username, amount) {
    // 1. Get current balance
    const currentBalance = await this.getBalanceByUsername(username);

    if (amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    // 2. Update balance in driver table
    const { error: updateError } = await supabase
        .from('driver')
        .update({'walletbalance': currentBalance - amount})
        .eq('username', username);

    if (updateError) throw updateError;

    // 3. Record transaction
    const { error: insertError } = await supabase.from('driverwallettransaction').insert({
      'driver_id': username,
      'amount': amount,
      'trantype': 'withdraw',
      'transtatus': 'Success'
    });

    if (insertError) throw insertError;
    
    return { success: true, newBalance: currentBalance - amount };
  }
}

module.exports = WalletModel;
