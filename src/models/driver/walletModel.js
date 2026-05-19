const supabase = require('./dbClient');

class WalletModel {
  static async getBalanceByUsername(username) {
    const { data, error } = await supabase
      .from('profiles')
      .select('wallet!inner(balance)')
      .eq('username', username)
      .single();

    if (error) {
      throw error;
    }
    
    const wallet = data.wallet;
    if (Array.isArray(wallet) && wallet.length > 0) {
      return wallet[0].balance || 0;
    } else if (wallet && typeof wallet === 'object') {
      return wallet.balance || 0;
    }
    return 0;
  }

  static async getTransactionsByUsername(username) {
    // 1. Get profile ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
        
    if (profileError) throw profileError;
    const profileId = profile.id;

    // 2. Fetch transactions
    const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

    if (txError) throw txError;
    return transactions;
  }

  static async withdraw(username, amount) {
    // 1. Get profile and wallet ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, wallet!inner(id)')
        .eq('username', username)
        .single();

    if (profileError) throw profileError;

    const profileId = profile.id;
    const wallet = profile.wallet;
    
    let walletId;
    if (Array.isArray(wallet) && wallet.length > 0) {
      walletId = wallet[0].id;
    } else if (wallet && typeof wallet === 'object') {
      walletId = wallet.id;
    }

    if (!walletId) throw new Error("Wallet not found");

    // 2. Get current balance
    const currentBalance = await this.getBalanceByUsername(username);

    if (amount > currentBalance) {
      throw new Error("Insufficient balance");
    }

    // 3. Update balance
    const { error: updateError } = await supabase
        .from('wallet')
        .update({'balance': currentBalance - amount})
        .eq('id', walletId);

    if (updateError) throw updateError;

    // 4. Record transaction
    const { error: insertError } = await supabase.from('transactions').insert({
      'profile_id': profileId,
      'amount': amount,
      'type': 'withdraw',
      'status': 'success',
    });

    if (insertError) throw insertError;
    
    return { success: true, newBalance: currentBalance - amount };
  }
}

module.exports = WalletModel;
