import React, { useState, useEffect } from 'react';
import { GameId, NavigationTab, User, Wallet } from './types.ts';
import { authApi, walletApi, subscribeToEvents } from './api/client.ts';
import { SplashScreen } from './components/SplashScreen.tsx';
import { AuthScreen } from './components/AuthScreen.tsx';
import { AppHeader } from './components/AppHeader.tsx';
import { BottomNavigation } from './components/BottomNavigation.tsx';
import { HomeScreen } from './screens/HomeScreen.tsx';
import { GamesScreen } from './screens/GamesScreen.tsx';
import { WalletScreen } from './screens/WalletScreen.tsx';
import { HistoryScreen } from './screens/HistoryScreen.tsx';
import { ProfileScreen } from './screens/ProfileScreen.tsx';
import { RouletteScreen } from './screens/RouletteScreen.tsx';
import { TeenPattiScreen } from './screens/TeenPattiScreen.tsx';
import { AviatorScreen } from './screens/AviatorScreen.tsx';
import { DiceScreen } from './screens/DiceScreen.tsx';
import { DragonTigerScreen } from './screens/DragonTigerScreen.tsx';
import { AndarBaharScreen } from './screens/AndarBaharScreen.tsx';
import { WinLossNotification } from './components/WinLossNotification.tsx';
import { AdminDashboard } from './components/admin/AdminDashboard.tsx';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet>({
    balance: 5000,
    bonus: 250,
    lockedAmount: 0,
    isDemo: false
  });
  const [activeTab, setActiveTab] = useState<NavigationTab>('home');
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [walletInitialTab, setWalletInitialTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [notificationsCount, setNotificationsCount] = useState(1);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const handleUpdateWallet = (newWallet: Partial<Wallet> | undefined | null) => {
    if (!newWallet) return;
    setWallet((prev) => ({
      ...prev,
      ...newWallet,
      balance: typeof newWallet.balance === 'number' ? newWallet.balance : prev.balance,
      bonus: typeof newWallet.bonus === 'number' ? newWallet.bonus : prev.bonus
    }));
  };

  // Check initial session & wallet
  useEffect(() => {
    const initApp = async () => {
      try {
        const authData = await authApi.getMe();
        if (authData.user) {
          setUser(authData.user);
          if (authData.wallet) {
            handleUpdateWallet(authData.wallet);
          }
        }
      } catch {
        // Unauthenticated session, show auth after splash
      }
    };
    initApp();
  }, []);

  // Listen to real-time events via SSE
  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      if (event.type === 'WALLET_UPDATE' && event.data) {
        handleUpdateWallet(event.data);
      } else if (event.type === 'NOTIFICATION' && event.data?.message) {
        setNotificationsCount((c) => c + 1);
        setNotificationToast(event.data.message);
        setTimeout(() => setNotificationToast(null), 4000);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (userData: User, walletData: Wallet) => {
    setUser(userData);
    if (walletData) {
      handleUpdateWallet(walletData);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveGame(null);
    setActiveTab('home');
  };

  const handleOpenWalletWithTab = (tab: 'deposit' | 'withdraw' = 'deposit') => {
    setWalletInitialTab(tab);
    setActiveTab('wallet');
    setActiveGame(null);
  };

  // 1. Show Splash Screen first
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // 2. If not logged in, show Auth Screen
  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  // 3. Strict Role Isolation: OWNER, SUPER_ADMIN, and ADMIN dashboards do NOT display games.
  // Games must be visible only to PLAYER users.
  if (user.role && user.role !== 'PLAYER') {
    return (
      <AdminDashboard
        currentUser={user}
        onRoleChanged={(updatedUser) => {
          setUser(updatedUser);
          setActiveGame(null);
        }}
        onLogout={handleLogout}
      />
    );
  }

  // 4. Render Active Game if user clicked into one of the 6 games (PLAYER only)
  if (activeGame) {
    let screenNode: React.ReactNode = null;
    switch (activeGame) {
      case 'roulette':
        screenNode = (
          <RouletteScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      case 'teen-patti':
        screenNode = (
          <TeenPattiScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      case 'aviator':
        screenNode = (
          <AviatorScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      case 'dice':
        screenNode = (
          <DiceScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      case 'dragon-tiger':
        screenNode = (
          <DragonTigerScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      case 'andar-bahar':
        screenNode = (
          <AndarBaharScreen
            wallet={wallet}
            onUpdateWallet={handleUpdateWallet}
            onBack={() => setActiveGame(null)}
            onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          />
        );
        break;
      default:
        setActiveGame(null);
        break;
    }

    if (screenNode) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative">
          <WinLossNotification />
          {screenNode}
        </div>
      );
    }
  }

  // 4. Main App Container (Mobile First max-w-md)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col relative bg-slate-950 shadow-2xl border-x border-slate-900/80 min-h-screen">
        <WinLossNotification />
        {/* Real-time Notification Toast */}
        {notificationToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl border border-amber-400 flex items-center justify-between text-xs animate-bounce">
            <span>{notificationToast}</span>
            <button
              type="button"
              onClick={() => setNotificationToast(null)}
              className="text-slate-950 font-black ml-2 text-sm"
            >
              ×
            </button>
          </div>
        )}

        {/* Global Top App Header */}
        <AppHeader
          user={user}
          wallet={wallet}
          notificationCount={notificationsCount}
          onOpenWallet={() => handleOpenWalletWithTab('deposit')}
          onOpenProfile={() => setActiveTab('profile')}
        />

        {/* Dynamic Tab Views */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === 'home' && (
            <HomeScreen
              user={user}
              wallet={wallet}
              onPlayGame={(gameId) => setActiveGame(gameId)}
              onOpenWallet={handleOpenWalletWithTab}
            />
          )}

          {activeTab === 'games' && (
            <GamesScreen onPlayGame={(gameId) => setActiveGame(gameId)} />
          )}

          {activeTab === 'wallet' && (
            <WalletScreen
              wallet={wallet}
              initialTab={walletInitialTab}
              onUpdateWallet={handleUpdateWallet}
            />
          )}

          {activeTab === 'history' && <HistoryScreen />}

          {activeTab === 'profile' && (
            <ProfileScreen
              user={user}
              wallet={wallet}
              onLogout={handleLogout}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onRoleChanged={(updatedUser) => {
                setUser(updatedUser);
              }}
            />
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}
