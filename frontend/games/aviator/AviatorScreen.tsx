import React, { useEffect, useRef, useState } from 'react';
import { Clock, Plane, ShieldCheck, Volume2, VolumeX, Menu, MessageCircle, Users, TrendingUp } from 'lucide-react';
import { AviatorBet, AviatorState, Wallet } from '../../../src/types.ts';
import { gamesApi, subscribeToRealtimeEvents } from '../../../src/api/client.ts';
import { GameHeader } from '../../../src/components/GameHeader.tsx';
import { RulesModal } from '../../../src/components/RulesModal.tsx';
import { AviatorReferenceCanvas } from './AviatorReferenceCanvas';
import { notifyWinLoss } from '../../../src/components/WinLossNotification.tsx';

interface AviatorScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

const demoPlayers = [
  ['SkyPilot', '1.42x'],
  ['AeroFox', '2.18x'],
  ['Cloud9', '3.06x'],
  ['NovaJet', '1.17x'],
  ['BlueWing', '4.21x'],
  ['Falcon', '1.83x'],
  ['Orbit', '5.44x'],
  ['JetStream', '2.71x']
];

export const AviatorScreen: React.FC<AviatorScreenProps> = ({
  wallet,
  onUpdateWallet,
  onBack,
  onOpenWallet
}) => {
  const [gameState, setGameState] = useState<AviatorState | null>(null);
  const [currentBet, setCurrentBet] = useState<AviatorBet | null>(null);
  const [betAmount, setBetAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const currentBetRef = useRef<AviatorBet | null>(null);
  currentBetRef.current = currentBet;

  useEffect(() => {
    let mounted = true;

    const syncState = async () => {
      try {
        const res = await gamesApi.aviator.getState();
        if (!mounted) return;
        setGameState({ ...res.state, previousMultipliers: Array.isArray(res.state.previousMultipliers) ? res.state.previousMultipliers : [] });
        setCurrentBet(res.state.currentBet ?? null);
      } catch {
        // WebSocket realtime events keep the live state synchronized.
      }
    };

    void syncState();

    const unsubscribe = subscribeToRealtimeEvents((payload) => {
      if (!mounted) return;
      const data: any = payload.data || {};

      if (payload.event === 'aviator_tick') {
        setGameState((prev) => prev ? {
          ...prev,
          roundId: data.roundId || prev.roundId,
          phase: data.phase || prev.phase,
          multiplier: Number(data.multiplier ?? prev.multiplier),
          countdown: Number(data.countdown ?? prev.countdown)
        } : null);
        return;
      }

      if (payload.event === 'round_started' && data.gameId === 'aviator') {
        void syncState();
        return;
      }

      if (payload.event === 'betting_closed' && data.gameId === 'aviator') {
        setGameState((prev) => prev ? { ...prev, phase: 'running' } : prev);
        return;
      }

      if (payload.event === 'result' && data.gameId === 'aviator') {
        setGameState((prev) => prev ? {
          ...prev,
          phase: 'crashed',
          multiplier: Number(data.multiplier ?? prev.multiplier),
          crashMultiplier: Number(data.multiplier ?? prev.crashMultiplier ?? 0),
          countdown: 0,
          previousMultipliers: Array.isArray(data.previousMultipliers)
            ? data.previousMultipliers
            : [Number(data.multiplier ?? prev.multiplier), ...(prev.previousMultipliers || [])].slice(0, 15)
        } : null);

        if (currentBetRef.current && !currentBetRef.current.cashedOut) {
          notifyWinLoss({ type: 'loss', amount: currentBetRef.current.amount, id: `aviator-loss-${data.roundId}` });
          setCurrentBet(null);
        }
        // Keep the terminal crash state visible. The next round_started event
        // performs the authoritative resync for the new betting round.
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handlePlaceBet = async () => {
    if (!gameState || gameState.phase !== 'betting') {
      setErrorMsg('Betting is only open during the countdown phase');
      return;
    }
    if (wallet.balance < betAmount) {
      setErrorMsg('Insufficient balance for this bet');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.placeBet(betAmount);
      setCurrentBet(res.bet);
      onUpdateWallet(res.wallet);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to place bet');
    } finally {
      setLoading(false);
    }
  };

  const handleCashout = async () => {
    if (!currentBet || currentBet.cashedOut || gameState?.phase !== 'running') return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.cashOut();
      onUpdateWallet(res.wallet);
      setCurrentBet((prev) => prev ? {
        ...prev,
        cashedOut: true,
        winAmount: res.winAmount
      } : null);

    } catch (err: any) {
      setErrorMsg(err.message || 'Cashout failed');
    } finally {
      setLoading(false);
    }
  };

  const multiplier = gameState?.multiplier || 1;
  const phase = gameState?.phase || 'betting';
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const progress = Math.min(1, Math.max(0, (multiplier - 1) / 8));
  const planeX = 7 + progress * 78;
  const planeY = 78 - progress * 58;

  const placeButton = () => (
    <button
      type="button"
      disabled={loading || phase !== 'betting'}
      onClick={handlePlaceBet}
      className="aviator-ref-action aviator-ref-action-bet"
    >
      {phase === 'betting' ? `PLACE BET · ₹${betAmount.toLocaleString('en-IN')}` : 'WAITING FOR NEXT ROUND'}
    </button>
  );

  const cashoutButton = (
    <button
      id="btn-aviator-cashout"
      type="button"
      disabled={loading}
      onClick={handleCashout}
      className="aviator-ref-action aviator-ref-action-cashout"
    >
      <span>CASH OUT</span>
      <small>₹{Math.floor((currentBet?.amount ?? 0) * multiplier).toLocaleString('en-IN')} · {multiplier.toFixed(2)}x</small>
    </button>
  );

  return (
    <div id="screen-aviator" className="aviator-reference-screen min-h-screen text-white">
      <GameHeader
        title="Aviator"
        gameId="aviator"
        balance={wallet.balance}
        isDemo={wallet.isDemo}
        roundId={gameState?.roundId}
        onBack={onBack}
        onOpenRules={() => setShowRules(true)}
        onOpenWallet={onOpenWallet}
      />

      <div className="aviator-reference-layout">
        <aside className="aviator-left-panel">
          <div className="aviator-panel-heading">
            <span>LIVE PLAYERS</span>
            <span className="aviator-live-dot" />
          </div>
          <div className="aviator-player-summary">
            <Users size={15} />
            <strong>{Math.max(1, 248 + (gameState?.roundId?.length || 0))}</strong>
            <span>players online</span>
          </div>
          <div className="aviator-player-list">
            {demoPlayers.map(([name, mult], index) => (
              <div className="aviator-player-row" key={name}>
                <span className="aviator-avatar">{name[0]}</span>
                <span className="aviator-player-name">{name}</span>
                <span className={`aviator-player-mult ${index % 3 === 0 ? 'hot' : ''}`}>{mult}</span>
              </div>
            ))}
          </div>
          <div className="aviator-side-history">
            <div className="aviator-panel-heading"><span>RECENT ROUNDS</span><TrendingUp size={14} /></div>
            {(gameState?.previousMultipliers || []).slice(0, 10).map((m, i) => (
              <span key={`${m}-${i}`} className={m >= 5 ? 'high' : m >= 2 ? 'mid' : 'low'}>{m.toFixed(2)}x</span>
            ))}
          </div>
        </aside>

        <main className="aviator-reference-main">
          <div className="aviator-reference-history">
            <Clock size={13} />
            {(gameState?.previousMultipliers || []).slice(0, 12).map((m, i) => (
              <span key={`${m}-top-${i}`} className={m >= 5 ? 'high' : m >= 2 ? 'mid' : 'low'}>{m.toFixed(2)}x</span>
            ))}
          </div>

          <section className="aviator-reference-arena">
            <AviatorReferenceCanvas
              phase={phase}
              multiplier={multiplier}
              crashMultiplier={gameState?.crashMultiplier}
              countdown={gameState?.countdown}
              muted={muted}
              onToggleMute={() => setMuted((v) => !v)}
            />
            <div className="aviator-arena-top">
              <span className="aviator-round-id">ROUND {gameState?.roundId || 'AV-SYNC'}</span>
              <span className={`aviator-status ${isRunning ? 'running' : isCrashed ? 'crashed' : 'waiting'}`}>
                {isRunning ? 'FLYING AWAY' : isCrashed ? `FLEW AWAY · ${(gameState?.crashMultiplier || multiplier).toFixed(2)}x` : `NEXT FLIGHT · ${gameState?.countdown || 5}s`}
              </span>
            </div>
          </section>

          {errorMsg && <div className="aviator-reference-error">{errorMsg}</div>}

          <section className="aviator-ref-bet-row">
            <div className="aviator-ref-bet-card">
              <div className="aviator-ref-tabs"><span className="active">BET</span><span>AUTO</span></div>
              <div className="aviator-ref-card-body">
                <div className="aviator-ref-amount">
                  <button type="button" onClick={() => setBetAmount((v) => Math.max(10, v - 10))}>−</button>
                  <strong>₹{betAmount.toLocaleString('en-IN')}</strong>
                  <button type="button" onClick={() => setBetAmount((v) => Math.min(25000, v + 10))}>+</button>
                </div>
                <div className="aviator-ref-quick">
                  {[50, 100, 500, 1000].map((n) => <button type="button" key={n} onClick={() => setBetAmount(n)}>₹{n}</button>)}
                </div>
                {currentBet && !currentBet.cashedOut && isRunning ? cashoutButton : placeButton()}
              </div>
            </div>
          </section>

          <footer className="aviator-reference-footer">
            <button type="button" onClick={() => setShowRules(true)}><ShieldCheck size={14} /> Server-authoritative game</button>
            <span>Round state synced in real time</span>
          </footer>
        </main>
      </div>

      {showMenu && (
        <div className="aviator-ref-modal-backdrop" onClick={() => setShowMenu(false)}>
          <div className="aviator-ref-menu" onClick={(e) => e.stopPropagation()}>
            <div className="aviator-ref-menu-title">GAME MENU</div>
            <button type="button" onClick={() => { setShowRules(true); setShowMenu(false); }}>How to play</button>
            <button type="button" onClick={() => setMuted((v) => !v)}>{muted ? 'Enable sound' : 'Mute sound'}</button>
            <button type="button" onClick={() => setShowMenu(false)}>Close</button>
          </div>
        </div>
      )}

      {showChat && (
        <div className="aviator-ref-modal-backdrop" onClick={() => setShowChat(false)}>
          <div className="aviator-ref-chat" onClick={(e) => e.stopPropagation()}>
            <div className="aviator-ref-menu-title">LIVE CHAT</div>
            <p>Realtime game events are shown in the main arena.</p>
            <button type="button" onClick={() => setShowChat(false)}>Close</button>
          </div>
        </div>
      )}

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Aviator"
        rules={[
          { heading: 'Flight', description: 'The multiplier increases while the server-authoritative flight is running.' },
          { heading: 'Round Sync', description: 'Round state is synchronized through the existing realtime transport.' },
          { heading: 'Cash Out', description: 'The existing server endpoint remains authoritative for settlement.' }
        ]}
      />
    </div>
  );
};
