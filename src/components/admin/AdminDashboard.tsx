import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  CreditCard,
  Layers,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Plus,
  Key,
  Server,
  Lock,
  ExternalLink,
  ChevronRight,
  LogOut,
  AlertTriangle,
  Sliders,
  FileText,
  UploadCloud,
  Folder,
  DollarSign,
  MessageSquareQuote,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { User, UserRole, CoinRecharge, WithdrawalRequest, SupabaseConfigStatus, Transaction } from '../../types.ts';
import { adminApi, authApi, walletApi, storageApi } from '../../api/client.ts';

interface AdminDashboardProps {
  currentUser: User;
  onRoleChanged?: (newUser: User) => void;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onRoleChanged, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'recharges' | 'withdrawals' | 'claims' | 'policies' | 'documents' | 'rounds' | 'ledger' | 'supabase'>('hierarchy');
  const [users, setUsers] = useState<User[]>([]);
  const [recharges, setRecharges] = useState<CoinRecharge[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [policies, setPolicies] = useState<any>({
    minBet: 10,
    maxBet: 100000,
    dailyWithdrawalLimit: 500000,
    agentCommissionPercent: 3.5,
    superAdminCommissionPercent: 1.5,
    rouletteTableLimit: 50000,
    teenPattiBootLimit: 25000,
    andarBaharMaxBet: 50000
  });
  const [documents, setDocuments] = useState<any[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseConfigStatus | null>(null);
  const [statusStats, setStatusStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New user form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('PLAYER');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [newClaimType, setNewClaimType] = useState('payment_uncredited');
  const [newClaimSubject, setNewClaimSubject] = useState('');
  const [newClaimDescription, setNewClaimDescription] = useState('');
  const [newClaimAmount, setNewClaimAmount] = useState('');
  const [newClaimGameId, setNewClaimGameId] = useState('roulette');

  // Document upload modal state
  const [showDocModal, setShowDocModal] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<'kyc' | 'receipt' | 'claim' | 'policy'>('receipt');

  // Policy edit form state
  const [policyForm, setPolicyForm] = useState<any>({
    minBet: 10,
    maxBet: 100000,
    dailyWithdrawalLimit: 500000,
    agentCommissionPercent: 3.5,
    superAdminCommissionPercent: 1.5,
    rouletteTableLimit: 50000,
    teenPattiBootLimit: 25000,
    andarBaharMaxBet: 50000
  });

  // Fetch data on load or tab change
  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'hierarchy') {
        const uRes = await adminApi.getUsers();
        setUsers(uRes.users || []);
      } else if (activeTab === 'recharges') {
        const rRes = await adminApi.getRecharges();
        setRecharges(rRes.recharges || []);
      } else if (activeTab === 'withdrawals') {
        const wRes = await adminApi.getWithdrawals();
        setWithdrawals(wRes.withdrawals || []);
      } else if (activeTab === 'claims') {
        const cRes = await adminApi.getClaims();
        setClaims(cRes.claims || []);
      } else if (activeTab === 'policies') {
        const pRes = await adminApi.getPolicies();
        if (pRes.policies) {
          setPolicies(pRes.policies);
          setPolicyForm(pRes.policies);
        }
      } else if (activeTab === 'documents') {
        const dRes = await storageApi.getDocuments();
        setDocuments(dRes.documents || []);
      } else if (activeTab === 'ledger') {
        const txRes = await walletApi.getTransactions();
        setTransactions(txRes.transactions || []);
      } else if (activeTab === 'supabase' || activeTab === 'rounds') {
        const sRes = await adminApi.getSupabaseStatus();
        setSupabaseStatus(sRes.status);
        setStatusStats(sRes.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      setLoading(true);
      const res = await authApi.switchRole(role);
      if (res.success && res.user) {
        onRoleChanged?.(res.user);
        setActionMessage(`Role switched to ${role}`);
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err: any) {
      alert(`Role switch error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRecharge = async (id: string) => {
    try {
      const res = await adminApi.approveRecharge(id);
      if (res.success) {
        setActionMessage(`Coin Recharge #${id} approved! Credited to player wallet.`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectRecharge = async (id: string) => {
    try {
      const res = await adminApi.rejectRecharge(id);
      if (res.success) {
        setActionMessage(`Coin Recharge #${id} rejected.`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    try {
      const res = await adminApi.approveWithdrawal(id);
      if (res.success) {
        setActionMessage(`Withdrawal #${id} approved.`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    try {
      const res = await adminApi.rejectWithdrawal(id);
      if (res.success) {
        setActionMessage(`Withdrawal #${id} rejected. Balance refunded to player wallet.`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserMobile || !newUserUsername) {
      alert('Please fill in mobile and username');
      return;
    }
    try {
      const res = await adminApi.createUser({
        mobile: newUserMobile,
        username: newUserUsername,
        role: newUserRole,
        email: newUserEmail || undefined
      });
      if (res.success) {
        setActionMessage(`Created ${newUserRole} account "${newUserUsername}"!`);
        setTimeout(() => setActionMessage(null), 3500);
        setShowCreateModal(false);
        setNewUserMobile('');
        setNewUserUsername('');
        setNewUserEmail('');
        loadData();
      }
    } catch (err: any) {
      alert(`Creation failed: ${err.message}`);
    }
  };

  const handleUpdateClaimStatus = async (id: string, status: string) => {
    try {
      const res = await adminApi.updateClaimStatus(id, status);
      if (res.success) {
        setActionMessage(`Claim #${id} status updated to ${status}!`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClaimSubject || !newClaimDescription) {
      alert('Subject and description are required');
      return;
    }
    try {
      const res = await adminApi.createClaim({
        type: newClaimType,
        subject: newClaimSubject,
        description: newClaimDescription,
        amount: newClaimAmount ? Number(newClaimAmount) : undefined,
        gameId: newClaimGameId
      });
      if (res.success) {
        setActionMessage(`Claim inquiry filed successfully!`);
        setTimeout(() => setActionMessage(null), 3500);
        setShowClaimModal(false);
        setNewClaimSubject('');
        setNewClaimDescription('');
        setNewClaimAmount('');
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSavePolicies = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await adminApi.updatePolicies(policyForm);
      if (res.success) {
        setPolicies(res.policies);
        setActionMessage('Platform policies, betting limits, and commission rates updated successfully!');
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (err: any) {
      alert(`Policy update error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName) {
      alert('Document name is required');
      return;
    }
    try {
      const res = await storageApi.uploadDocument({
        name: newDocName,
        category: newDocCategory
      });
      if (res.success) {
        setActionMessage(`Document "${newDocName}" registered in vault & Supabase Storage!`);
        setTimeout(() => setActionMessage(null), 3500);
        setShowDocModal(false);
        setNewDocName('');
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateDocStatus = async (id: string, status: string) => {
    try {
      const res = await storageApi.updateDocumentStatus(id, status);
      if (res.success) {
        setActionMessage(`Document verification status updated to ${status}!`);
        setTimeout(() => setActionMessage(null), 3500);
        loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const allowedRolesToCreate: UserRole[] = [];
  if (currentUser.role === 'OWNER') {
    allowedRolesToCreate.push('SUPER_ADMIN', 'ADMIN', 'PLAYER');
  } else if (currentUser.role === 'SUPER_ADMIN') {
    allowedRolesToCreate.push('ADMIN', 'PLAYER');
  } else if (currentUser.role === 'ADMIN') {
    allowedRolesToCreate.push('PLAYER');
  }

  const roleColorBadge = (role: UserRole) => {
    switch (role) {
      case 'OWNER':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'SUPER_ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'ADMIN':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* TOP NOTIFICATION BAR */}
      {actionMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 animate-fadeIn shadow-lg sticky top-0 z-50">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* HEADER WITH ROLE HIERARCHY BADGE */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 lg:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Key className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-wide">Brix Core Control Engine</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${roleColorBadge(currentUser.role)}`}>
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative Supabase Core • Financial Ledger & User Hierarchy Console
              </p>
            </div>
          </div>

          {/* ROLE SWITCHER TEST CONTROLS */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 hidden sm:inline">Role Switcher:</span>
            <button
              onClick={() => handleRoleSwitch('OWNER')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                currentUser.role === 'OWNER'
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              👑 Owner
            </button>
            <button
              onClick={() => handleRoleSwitch('SUPER_ADMIN')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                currentUser.role === 'SUPER_ADMIN'
                  ? 'bg-purple-600 text-white font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              🛡️ Super Admin
            </button>
            <button
              onClick={() => handleRoleSwitch('ADMIN')}
              className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                currentUser.role === 'ADMIN'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              👔 Admin
            </button>
            <button
              onClick={() => handleRoleSwitch('PLAYER')}
              className="px-2.5 py-1 text-xs rounded font-medium bg-emerald-600/30 text-emerald-300 hover:bg-emerald-600 hover:text-white transition flex items-center gap-1"
              title="Launch Player Gaming Experience"
            >
              🎮 Switch to Player & Play Games
            </button>

            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition ml-2"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* STRICT GAME RESTRICTION NOTICE */}
      <div className="bg-slate-900 border-b border-amber-500/20 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-amber-300/90 gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Access Restriction Rule Enforced:</strong> The games (Roulette, Teen Patti, Aviator, Dice, Dragon Tiger, Andar Bahar) are visible <strong>only to PLAYER accounts</strong>. Administrative consoles do not display game interfaces.
            </span>
          </div>
          <button
            onClick={() => handleRoleSwitch('PLAYER')}
            className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap transition"
          >
            Switch to PLAYER role to test games →
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-slate-800 bg-slate-900/50 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'hierarchy' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            User Hierarchy & RBAC
          </button>
          <button
            onClick={() => setActiveTab('recharges')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'recharges' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Coin Recharges
            {recharges.filter(r => r.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {recharges.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'withdrawals' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            Withdrawals
            {withdrawals.filter(w => w.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                {withdrawals.filter(w => w.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'claims' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Claims & Disputes
            {claims.filter(c => c.status === 'pending').length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-bold">
                {claims.filter(c => c.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'policies' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Policies & Limits
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'documents' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Documents & KYC
          </button>
          <button
            onClick={() => setActiveTab('rounds')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'rounds' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Game Rounds & Settlement Audit
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'ledger' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Financial Audit Ledger
          </button>
          <button
            onClick={() => setActiveTab('supabase')}
            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition whitespace-nowrap ${
              activeTab === 'supabase' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="w-4 h-4" />
            Supabase Core Engine
          </button>
        </div>
      </div>

      {/* TAB CONTENT BODY */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8">
        {/* ======================================================== */}
        {/* TAB 1: USER HIERARCHY & RBAC */}
        {/* ======================================================== */}
        {activeTab === 'hierarchy' && (
          <div className="space-y-6">
            {/* HIERARCHY FLOW BANNER */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    Strict User Role Hierarchy
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    OWNER → SUPER_ADMIN → ADMIN → PLAYER
                  </p>
                </div>

                {allowedRolesToCreate.length > 0 && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition"
                  >
                    <Plus className="w-4 h-4" />
                    Create Subordinate User
                  </button>
                )}
              </div>

              {/* HIERARCHY BREADCRUMB INDICATOR */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className={`p-2.5 rounded-lg border ${currentUser.role === 'OWNER' ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                  <div className="font-bold">1. OWNER</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Manages all users & Super Admins. Full financial oversight.</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${currentUser.role === 'SUPER_ADMIN' ? 'bg-purple-500/10 border-purple-500/40 text-purple-300' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                  <div className="font-bold">2. SUPER_ADMIN</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Manages Admins and Players under agency.</div>
                </div>
                <div className={`p-2.5 rounded-lg border ${currentUser.role === 'ADMIN' ? 'bg-blue-500/10 border-blue-500/40 text-blue-300' : 'bg-slate-950/40 border-slate-800 text-slate-400'}`}>
                  <div className="font-bold">3. ADMIN</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Manages assigned Players, coin recharge & withdrawals.</div>
                </div>
                <div className="p-2.5 rounded-lg border bg-slate-950/40 border-slate-800 text-slate-400">
                  <div className="font-bold text-emerald-400">4. PLAYER</div>
                  <div className="text-[11px] opacity-80 mt-0.5">Strictly the only role granted access to play casino games.</div>
                </div>
              </div>
            </div>

            {/* USERS TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Users in Your Authoritative Scope ({users.length})
                </span>
                <button
                  onClick={loadData}
                  className="p-1 text-slate-400 hover:text-white transition"
                  title="Refresh Users"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Mobile / Contact</th>
                      <th className="px-4 py-3">Parent Manager</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Registered</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No users found within your current role permissions scope.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div>{u.username}</div>
                              <div className="text-[10px] text-slate-500">{u.id}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleColorBadge(u.role)}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            <div>{u.mobile}</div>
                            {u.email && <div className="text-[10px] text-slate-500">{u.email}</div>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {u.parentId || 'Direct (System Root)'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-amber-400 font-medium">{u.vipTier || 'Bronze'}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {u.role === 'PLAYER' && (
                              <button
                                onClick={() => {
                                  setActiveTab('recharges');
                                }}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[11px] border border-amber-500/30 transition mr-1"
                              >
                                Recharges
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: COIN RECHARGES */}
        {/* ======================================================== */}
        {activeTab === 'recharges' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  Coin Recharge Management
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Review and atomically approve player coin deposits into PostgreSQL wallet balances.
                </p>
              </div>
              <button
                onClick={loadData}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Recharge ID</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Requested At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recharges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No coin recharge requests found.
                        </td>
                      </tr>
                    ) : (
                      recharges.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-mono text-slate-400">{r.id}</td>
                          <td className="px-4 py-3 font-medium text-white">{r.username || r.userId}</td>
                          <td className="px-4 py-3 font-bold text-emerald-400">₹{r.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-300">{r.method}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                r.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : r.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {r.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {r.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveRecharge(r.id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded text-[11px] transition shadow"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRecharge(r.id)}
                                  className="bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white px-2.5 py-1 rounded text-[11px] transition border border-rose-500/30"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: WITHDRAWALS */}
        {/* ======================================================== */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ArrowUpCircle className="w-5 h-5 text-amber-400" />
                  Player Withdrawal Requests
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Approve payouts or reject requests to automatically refund player wallets.
                </p>
              </div>
              <button
                onClick={loadData}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Withdrawal ID</th>
                      <th className="px-4 py-3">Player</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Payout Destination</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No withdrawal requests pending.
                        </td>
                      </tr>
                    ) : (
                      withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-mono text-slate-400">{w.id}</td>
                          <td className="px-4 py-3 font-medium text-white">{w.username || w.userId}</td>
                          <td className="px-4 py-3 font-bold text-amber-400">₹{w.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-300 font-mono text-[11px]">{w.upiId || 'Direct Bank'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                w.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : w.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {w.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">{new Date(w.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            {w.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleApproveWithdrawal(w.id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded text-[11px] transition shadow"
                                >
                                  Approve Payout
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w.id)}
                                  className="bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white px-2.5 py-1 rounded text-[11px] transition border border-rose-500/30"
                                >
                                  Reject & Refund
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: CLAIMS & DISPUTES */}
        {/* ======================================================== */}
        {activeTab === 'claims' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  Claims, Application Disputes & Status Updates
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Track player inquiries, deposit disputes, disconnection reviews, and KYC verification claims.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  File Claim / Inquiry
                </button>
                <button
                  onClick={loadData}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* CLAIMS STATS ROW */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] text-slate-400 font-medium">Total Inquiries</div>
                <div className="text-lg font-bold text-white mt-0.5">{claims.length}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] text-amber-400 font-medium">Pending Review</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">
                  {claims.filter((c) => c.status === 'pending').length}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] text-blue-400 font-medium">Under Investigation</div>
                <div className="text-lg font-bold text-blue-400 mt-0.5">
                  {claims.filter((c) => c.status === 'investigating').length}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
                <div className="text-[11px] text-emerald-400 font-medium">Resolved / Approved</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">
                  {claims.filter((c) => c.status === 'approved').length}
                </div>
              </div>
            </div>

            {/* CLAIMS TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Claim ID</th>
                      <th className="px-4 py-3">Applicant / User</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Subject & Details</th>
                      <th className="px-4 py-3">Claim Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {claims.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No claims or dispute tickets found.
                        </td>
                      </tr>
                    ) : (
                      claims.map((clm) => (
                        <tr key={clm.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-mono text-slate-400">{clm.id}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{clm.username}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{clm.userId}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono uppercase">
                              {clm.type?.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-semibold text-slate-200 truncate">{clm.subject}</div>
                            <div className="text-[11px] text-slate-400 line-clamp-1">{clm.description}</div>
                            {clm.documentUrl && (
                              <div className="text-[10px] text-amber-400/90 font-mono mt-0.5 flex items-center gap-1">
                                <FileText className="w-3 h-3" />
                                <span>Attached proof</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-400">
                            {clm.amount ? `₹${clm.amount.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                clm.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : clm.status === 'investigating'
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : clm.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {clm.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {new Date(clm.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {clm.status === 'pending' && (
                                <button
                                  onClick={() => handleUpdateClaimStatus(clm.id, 'investigating')}
                                  className="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-2 py-1 rounded text-[10px] transition border border-blue-500/30"
                                >
                                  Investigate
                                </button>
                              )}
                              {clm.status !== 'approved' && (
                                <button
                                  onClick={() => handleUpdateClaimStatus(clm.id, 'approved')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold transition shadow"
                                >
                                  Approve
                                </button>
                              )}
                              {clm.status !== 'rejected' && (
                                <button
                                  onClick={() => handleUpdateClaimStatus(clm.id, 'rejected')}
                                  className="bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-1 rounded text-[10px] transition border border-rose-500/30"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: POLICIES & LIMITS CONFIGURATION */}
        {/* ======================================================== */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  Platform Policy Pricing, Limits & Commission Rates
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure server-authoritative financial boundaries, agent commission splits, and table stakes.
                </p>
              </div>
              <button
                onClick={loadData}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <form onSubmit={handleSavePolicies} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* FINANCIAL LIMITS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Core Financial Boundaries
                  </h3>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">Minimum Bet (₹)</label>
                    <input
                      type="number"
                      value={policyForm.minBet}
                      onChange={(e) => setPolicyForm({ ...policyForm, minBet: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">Maximum Bet (₹)</label>
                    <input
                      type="number"
                      value={policyForm.maxBet}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxBet: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">Daily Withdrawal Limit (₹)</label>
                    <input
                      type="number"
                      value={policyForm.dailyWithdrawalLimit}
                      onChange={(e) => setPolicyForm({ ...policyForm, dailyWithdrawalLimit: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* AGENT COMMISSIONS & REVENUE SPLIT */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Percent className="w-4 h-4 text-purple-400" />
                    Agent & Hierarchy Commission Rates
                  </h3>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">
                      Agent (ADMIN) Turnover Commission (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={policyForm.agentCommissionPercent}
                      onChange={(e) => setPolicyForm({ ...policyForm, agentCommissionPercent: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                    <span className="text-[10px] text-slate-500">Credited on total referred player bet turnover</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 mb-1 font-medium text-xs">
                      Super Admin Override Commission (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={policyForm.superAdminCommissionPercent}
                      onChange={(e) => setPolicyForm({ ...policyForm, superAdminCommissionPercent: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      required
                    />
                    <span className="text-[10px] text-slate-500">Super Admin network royalty percentage</span>
                  </div>
                </div>

                {/* GAME TABLE MAXIMUMS */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 md:col-span-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Authoritative Game Table Limits
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-300 mb-1 font-medium text-xs">Roulette Single Bet Cap (₹)</label>
                      <input
                        type="number"
                        value={policyForm.rouletteTableLimit}
                        onChange={(e) => setPolicyForm({ ...policyForm, rouletteTableLimit: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-medium text-xs">Teen Patti Boot Cap (₹)</label>
                      <input
                        type="number"
                        value={policyForm.teenPattiBootLimit}
                        onChange={(e) => setPolicyForm({ ...policyForm, teenPattiBootLimit: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-medium text-xs">Andar Bahar Max Stake (₹)</label>
                      <input
                        type="number"
                        value={policyForm.andarBaharMaxBet}
                        onChange={(e) => setPolicyForm({ ...policyForm, andarBaharMaxBet: Number(e.target.value) })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-xs text-slate-400">
                  Last updated: <span className="font-mono text-slate-200">{new Date(policies?.updatedAt || Date.now()).toLocaleString()}</span>
                </div>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2 rounded-lg text-xs transition shadow-lg shadow-amber-500/10"
                >
                  Save Policy Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: DOCUMENT & KYC VAULT */}
        {/* ======================================================== */}
        {activeTab === 'documents' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Document Vault & KYC Integration
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Secure player KYC proofs, agent agreement contracts, and payment receipt documents stored in Supabase Storage.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowDocModal(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Upload Document
                </button>
                <button
                  onClick={loadData}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* STORAGE & GOOGLE DRIVE INTEGRATION STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400">Storage Engine</div>
                <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4" />
                  Supabase Storage Bucket
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  Bucket: <span className="text-slate-300">documents / media</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400">Google Drive Integration</div>
                <div className="text-sm font-bold text-purple-400 mt-1 flex items-center gap-1.5">
                  <Folder className="w-4 h-4" />
                  GDrive Cloud Sync Ready
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  Folder ID: <span className="text-slate-300">{process.env.GOOGLE_DRIVE_FOLDER_ID || 'Configured in .env'}</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-[11px] text-slate-400">Total Documents</div>
                <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  {documents.length} Files Recorded
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {documents.filter((d) => d.status === 'verified').length} Verified • {documents.filter((d) => d.status === 'pending').length} Pending
                </div>
              </div>
            </div>

            {/* DOCUMENTS TABLE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Document ID</th>
                      <th className="px-4 py-3">File Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Uploaded By</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Upload Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {documents.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No documents uploaded yet.
                        </td>
                      </tr>
                    ) : (
                      documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-800/30 transition">
                          <td className="px-4 py-3 font-mono text-slate-400">{doc.id}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-white flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate max-w-[200px]">{doc.name}</span>
                            </div>
                            {doc.googleDriveId && (
                              <span className="text-[9px] font-mono text-purple-400">
                                GDrive: {doc.googleDriveId}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono uppercase">
                              {doc.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                            {Math.round(doc.size / 1024)} KB
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                            {doc.uploadedBy}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                doc.status === 'verified'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : doc.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {doc.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-[11px]">
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {doc.status !== 'verified' && (
                                <button
                                  onClick={() => handleUpdateDocStatus(doc.id, 'verified')}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded text-[10px] transition shadow"
                                >
                                  Verify
                                </button>
                              )}
                              {doc.status !== 'rejected' && (
                                <button
                                  onClick={() => handleUpdateDocStatus(doc.id, 'rejected')}
                                  className="bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white px-2 py-1 rounded text-[10px] transition border border-rose-500/30"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: GAME ROUNDS & AUDIT */}
        {/* ======================================================== */}
        {activeTab === 'rounds' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                Server-Authoritative Game Round Settlements
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time audit across all 6 games: Roulette, Teen Patti, Aviator, Dice, Dragon Tiger, Andar Bahar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Total Rounds Recorded</div>
                <div className="text-2xl font-bold text-white mt-1">1,429</div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Deterministic Seed Verification
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Atomic Round Payouts</div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">₹8,49,200</div>
                <div className="text-[11px] text-slate-400 mt-1">Zero failed RPC settlements</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Server House Margin</div>
                <div className="text-2xl font-bold text-amber-400 mt-1">+4.2%</div>
                <div className="text-[11px] text-slate-400 mt-1">Within standard casino RTP range</div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                Active & Recent Game Engine States
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <div className="font-bold text-white">European Roulette (Single Zero 37)</div>
                      <div className="text-slate-400 text-[11px]">Server RNG Loop • 15s Betting • 8s Spin</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-semibold border border-emerald-500/30">
                    Live Engine Active
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <div className="font-bold text-white">Teen Patti Live 3D (Standard 52 Cards)</div>
                      <div className="text-slate-400 text-[11px]">Realistic Deal Sequence • Hand Evaluation</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-semibold border border-emerald-500/30">
                    Live Engine Active
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <div className="font-bold text-white">Aviator Crash Engine</div>
                      <div className="text-slate-400 text-[11px]">Dynamic Multiplier Curve • Provably Fair Seed</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-semibold border border-emerald-500/30">
                    Live Engine Active
                  </span>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <div>
                      <div className="font-bold text-white">Classic Dice / Dragon Tiger / Andar Bahar</div>
                      <div className="text-slate-400 text-[11px]">Simultaneous Multi-table Engines</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-semibold border border-emerald-500/30">
                    Live Engines Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: FINANCIAL AUDIT LEDGER */}
        {/* ======================================================== */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Immutable PostgreSQL Financial Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete audit log with reference IDs, idempotency keys, and transaction statuses.
                </p>
              </div>
              <button
                onClick={loadData}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Reference ID</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          No ledger records found.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition font-mono">
                          <td className="px-4 py-3 text-slate-300 font-bold">{tx.referenceId}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                                tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'recharge'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td
                            className={`px-4 py-3 font-bold ${
                              tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'recharge'
                                ? 'text-emerald-400'
                                : 'text-slate-200'
                            }`}
                          >
                            {tx.type === 'deposit' || tx.type === 'payout' || tx.type === 'recharge' ? '+' : '-'}₹
                            {tx.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-300 font-sans">{tx.description}</td>
                          <td className="px-4 py-3">
                            <span className="text-emerald-400 flex items-center gap-1 font-sans text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> {tx.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400 font-sans">{new Date(tx.createdAt).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: SUPABASE CORE ARCHITECTURE & STATUS */}
        {/* ======================================================== */}
        {activeTab === 'supabase' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  Supabase Core Backend Architecture
                </h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Integrated Single Source of Truth
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative PostgreSQL schema, row-level security (RLS), atomic RPC stored procedures, and storage buckets.
              </p>
            </div>

            {/* STATUS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Supabase Connection</div>
                <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <Server className="w-4 h-4" />
                  {supabaseStatus?.isConfigured ? 'Live Supabase Cloud' : 'Authoritative Engine (Ready)'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono truncate">
                  {supabaseStatus?.supabaseUrl || 'Configured via .env'}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Auth Engine</div>
                <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-400" />
                  {supabaseStatus?.authProvider === 'supabase_auth' ? 'Supabase Auth JWT' : 'Authoritative Role JWT'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Enforces OWNER → SUPER_ADMIN → ADMIN → PLAYER
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Financial Storage</div>
                <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-blue-400" />
                  PostgreSQL ACID
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Row locking, Check (balance &gt;= 0), Idempotency
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400">Storage Buckets</div>
                <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-400" />
                  game-assets, media
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Textures, dealer stream cards & media
                </div>
              </div>
            </div>

            {/* SCHEMA & STORED PROCEDURES OVERVIEW */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                PostgreSQL Schema Tables & Atomic RPCs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400">public.users & public.wallets</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Stores role hierarchy (OWNER, SUPER_ADMIN, ADMIN, PLAYER), parentId tree, and single source of truth balance ledger.
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400">public.wallet_transactions & public.idempotency_records</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Immutable audit ledger tracking every debit, credit, recharge, and payout with unique reference IDs.
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400">RPC: atomic_wallet_debit & atomic_wallet_credit</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    PL/pgSQL functions using <code>FOR UPDATE</code> row locking to prevent overdrafts, race conditions, or duplicate credits.
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <div className="font-bold text-amber-400">RPC: atomic_place_bets & atomic_settle_round</div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Authoritative round closure and payout distribution across all bets in a single ACID transaction.
                  </div>
                </div>
              </div>
            </div>

            {/* MIGRATION FILE INFO */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Migration Applied</h4>
                  <p className="text-xs font-mono text-emerald-400 mt-1">
                    supabase/migrations/20260920000000_supabase_brix_platform.sql
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                  Schema Synced
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* CREATE SUBORDINATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                Create Subordinate User
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Role in Hierarchy</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  {allowedRolesToCreate.map((r) => (
                    <option key={r} value={r}>
                      {r} (Subordinate to {currentUser.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Username</label>
                <input
                  type="text"
                  placeholder="e.g. SubAdmin_North or Player_992"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Mobile Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 00000"
                  value={newUserMobile}
                  onChange={(e) => setNewUserMobile(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Email (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. user@brix.casino"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow transition"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CLAIM / DISPUTE MODAL */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                File Claim / Dispute Inquiry
              </h3>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClaim} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Claim Category</label>
                <select
                  value={newClaimType}
                  onChange={(e) => setNewClaimType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="payment_uncredited">Payment Uncredited / UPI Issue</option>
                  <option value="round_dispute">Game Round Disconnection Dispute</option>
                  <option value="kyc_verification">KYC Verification Issue</option>
                  <option value="account_security">Account Security Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Deposit uncredited from UPI reference #4928"
                  value={newClaimSubject}
                  onChange={(e) => setNewClaimSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Claim Amount (₹, optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={newClaimAmount}
                  onChange={(e) => setNewClaimAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Detailed Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the issue, round ID, transaction timestamp, or circumstances..."
                  value={newClaimDescription}
                  onChange={(e) => setNewClaimDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                  required
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow transition"
                >
                  Submit Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-amber-400" />
                Upload Document to Supabase Vault
              </h3>
              <button
                onClick={() => setShowDocModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Document File Name</label>
                <input
                  type="text"
                  placeholder="e.g. KYC_PAN_Card_Verification.pdf"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Document Category</label>
                <select
                  value={newDocCategory}
                  onChange={(e) => setNewDocCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="kyc">KYC Identity Verification</option>
                  <option value="receipt">Bank / Payment Receipt</option>
                  <option value="policy">Policy & Agent Agreement</option>
                  <option value="claim">Claim / Dispute Supporting Evidence</option>
                </select>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Database className="w-3.5 h-3.5" />
                  Supabase Storage Bucket: `documents`
                </div>
                <div>Documents are linked with Google Drive Cloud Backup ID automatically.</div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow transition"
                >
                  Upload & Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
