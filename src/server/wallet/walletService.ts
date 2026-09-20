import crypto from 'node:crypto';
import { CoinRecharge, Transaction, Wallet, WithdrawalRequest } from '../../types.ts';
import { supabaseRepo } from '../supabase/supabaseClient.ts';

export const walletService = {
  // Authoritative balance read
  async getBalance(userId: string): Promise<Wallet> {
    return supabaseRepo.getWallet(userId);
  },

  // Atomic debit (for bets, withdrawals)
  async debit(
    userId: string,
    amount: number,
    type: 'bet' | 'withdrawal',
    description: string,
    gameId?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    if (amount <= 0) {
      throw new Error('Debit amount must be greater than zero');
    }
    return supabaseRepo.atomicDebit(userId, amount, type, description, gameId, idempotencyKey);
  },

  // Atomic credit (for payouts, deposits, refunds, recharges)
  async credit(
    userId: string,
    amount: number,
    type: 'payout' | 'deposit' | 'bonus' | 'recharge' | 'refund',
    description: string,
    gameId?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; wallet: Wallet; transaction: Transaction }> {
    if (amount <= 0) {
      throw new Error('Credit amount must be greater than zero');
    }
    return supabaseRepo.atomicCredit(userId, amount, type, description, gameId, idempotencyKey);
  },

  // Deposit creates a pending recharge request. Balance is credited only after verified payment approval/webhook.
  async deposit(
    userId: string,
    amount: number,
    method = 'UPI',
    _idempotencyKey?: string
  ): Promise<{ success: boolean; wallet: Wallet; request: CoinRecharge }> {
    if (amount <= 0) throw new Error('Deposit amount must be greater than zero');
    const request = await supabaseRepo.createRecharge(userId, amount, method);
    const wallet = await supabaseRepo.getWallet(userId);
    return { success: true, request, wallet };
  },

  // Request withdrawal
  async requestWithdrawal(
    userId: string,
    amount: number,
    upiId: string,
    _idempotencyKey?: string
  ): Promise<{ success: boolean; request: WithdrawalRequest; wallet: Wallet }> {
    if (amount <= 0) throw new Error('Withdrawal amount must be greater than zero');
    const request = await supabaseRepo.createWithdrawal(userId, amount, upiId, _idempotencyKey || `wth_${crypto.randomUUID()}`);
    const wallet = await supabaseRepo.getWallet(userId);
    return { success: true, request, wallet };
  },

  // Approve withdrawal (Admin/Owner)
  async approveWithdrawal(withdrawalId: string, approvedByUserId: string): Promise<WithdrawalRequest> {
    return supabaseRepo.approveWithdrawal(withdrawalId, approvedByUserId);
  },

  // Reject withdrawal (Admin/Owner)
  async rejectWithdrawal(withdrawalId: string, rejectedByUserId: string): Promise<WithdrawalRequest> {
    return supabaseRepo.rejectWithdrawal(withdrawalId, rejectedByUserId);
  },

  // Coin recharge request
  async requestCoinRecharge(userId: string, amount: number, method = 'UPI'): Promise<CoinRecharge> {
    return supabaseRepo.createRecharge(userId, amount, method);
  },

  // Approve coin recharge (Admin/Owner)
  async approveCoinRecharge(rechargeId: string, approvedByUserId: string): Promise<CoinRecharge> {
    return supabaseRepo.approveRecharge(rechargeId, approvedByUserId);
  },

  // Reject coin recharge
  async rejectCoinRecharge(rechargeId: string, rejectedByUserId: string): Promise<CoinRecharge> {
    return supabaseRepo.rejectRecharge(rechargeId, rejectedByUserId);
  },

  // Retrieve transactions ledger
  async getTransactions(userId?: string): Promise<Transaction[]> {
    return supabaseRepo.getTransactions(userId);
  },

  // Retrieve pending recharges
  async getRecharges(): Promise<CoinRecharge[]> {
    return supabaseRepo.getRecharges();
  },

  // Retrieve pending withdrawals
  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    return supabaseRepo.getWithdrawals();
  }
};
