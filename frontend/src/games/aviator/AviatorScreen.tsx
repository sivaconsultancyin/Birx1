import React, { useEffect, useRef, useState } from 'react';
import { Clock, Plane, ShieldCheck, Volume2, VolumeX, Menu, MessageCircle, Users, TrendingUp } from 'lucide-react';
import { AviatorBet, AviatorState, Wallet } from '../../../src/types.ts';
import { gamesApi, subscribeToRealtimeEvents } from '../../../src/api/client.ts';
import { GameHeader } from '../../../src/components/GameHeader.tsx';
import { RulesModal } from '../../../src/components/RulesModal.tsx';
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
  const planeRef = useRef<HTMLDivElement | null>(null);
  currentBetRef.current = currentBet;

  useEffect(() => {
    let mounted = true;

    const syncState = async () => {
      try {
        const res = await gamesApi.aviator.getState();
        if (!mounted) return;
        setGameState(res.state);
        setCurrentBet(res.state.currentBet ?? null);
      } catch {
        // SSE can recover the live state.
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
          crashMultiplier: Number(data.multiplier ?? prev.crashMultiplier ?? 0)
        } : null);

        if (currentBetRef.current && !currentBetRef.current.cashedOut) {
          notifyWinLoss({ type: 'loss', amount: currentBetRef.current.amount });
          setCurrentBet(null);
        }
        void syncState();
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
      notifyWinLoss({ type: 'win', amount: res.winAmount });
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

  // Keep the plane on the exact same curve geometry used by the SVG.
  const progress = Math.min(1, Math.max(0, Math.log(Math.max(1, multiplier)) / Math.log(10)));
  const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3;
  const curvePoint = (t: number) => {
    if (t <= 0.5) {
      const u = t * 2;
      return {
        x: cubic(0, 180, 250, 390, u),
        y: cubic(550, 540, 500 - progress * 100, 460 - progress * 210, u)
      };
    }
    const u = (t - 0.5) * 2;
    return {
      x: cubic(390, 530, 670, 1000, u),
      y: cubic(460 - progress * 210, 420 - progress * 200, 300 - progress * 200, 60 - progress * 40, u)
    };
  };
  const planePoint = curvePoint(progress);
  const planeX = (planePoint.x / 1000) * 100;
  const planeY = (planePoint.y / 560) * 100;

  const placeButton = (secondary = false) => (
    <button
      type="button"
      disabled={secondary || loading || phase !== 'betting'}
      onClick={secondary ? undefined : handlePlaceBet}
      className={`aviator-ref-action ${secondary ? 'aviator-ref-action-muted' : 'aviator-ref-action-bet'}`}
    >
      {secondary ? 'SECOND SLOT' : phase === 'betting' ? `PLACE BET · ₹${betAmount.toLocaleString('en-IN')}` : 'WAITING FOR NEXT ROUND'}
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
            <div className="aviator-stars" aria-hidden="true">
              {Array.from({ length: 34 }, (_, i) => <i key={i} style={{ ['--i' as any]: i }} />)}
            </div>
            <div className="aviator-cloud cloud-one" />
            <div className="aviator-cloud cloud-two" />

            <div className="aviator-arena-top">
              <span className="aviator-round-id">ROUND {gameState?.roundId || 'AV-SYNC'}</span>
              <span className={`aviator-status ${isRunning ? 'running' : isCrashed ? 'crashed' : 'waiting'}`}>
                {isRunning ? 'FLYING AWAY' : isCrashed ? `FLEW AWAY · ${(gameState?.crashMultiplier || multiplier).toFixed(2)}x` : `NEXT FLIGHT · ${gameState?.countdown || 5}s`}
              </span>
            </div>

            <svg className="aviator-reference-curve" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="aviatorCurve" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff2d55" stopOpacity=".18" />
                  <stop offset="55%" stopColor="#ff4b3e" stopOpacity=".55" />
                  <stop offset="100%" stopColor="#ff9f43" stopOpacity=".95" />
                </linearGradient>
                <linearGradient id="aviatorFill" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff2d55" stopOpacity=".02" />
                  <stop offset="100%" stopColor="#ff7a45" stopOpacity=".22" />
                </linearGradient>
              </defs>
              <path d={`M 0 550 C 180 540, 250 ${500 - progress * 100}, 390 ${460 - progress * 210} S 670 ${300 - progress * 200}, 1000 ${60 - progress * 40}`} fill="none" stroke="url(#aviatorCurve)" strokeWidth="6" strokeLinecap="round" />
              <path d={`M 0 550 C 180 540, 250 ${500 - progress * 100}, 390 ${460 - progress * 210} S 670 ${300 - progress * 200}, 1000 ${60 - progress * 40} L 1000 560 L 0 560 Z`} fill="url(#aviatorFill)" />
            </svg>

            <div className={`aviator-reference-multiplier ${isCrashed ? 'crashed' : ''}`}>
              {isCrashed && <div className="aviator-flew-away">FLEW AWAY</div>}
              <strong>{isCrashed ? (gameState?.crashMultiplier || multiplier).toFixed(2) : isRunning ? multiplier.toFixed(2) : '1.00'}x</strong>
              {!isRunning && !isCrashed && <span>WAITING FOR TAKEOFF</span>}
            </div>

            {(isRunning || isCrashed) && (
              <div
                ref={planeRef}
                className={`aviator-reference-plane ${isCrashed ? 'crashed' : ''}`}
                style={{ left: `${planeX}%`, top: `${planeY}%`, transition: 'left 90ms linear, top 90ms linear, transform 180ms ease-out, opacity 180ms ease-out', transform: isCrashed ? 'translate3d(42px, -34px, 0) rotate(-8deg)' : 'translate3d(0, 0, 0)', opacity: isCrashed ? 0 : 1 }}
              >
                <Plane size={58} fill="currentColor" />
                <span />
              </div>
            )}

            {!isRunning && !isCrashed && (
              <div className="aviator-takeoff">
                <span>FLIGHT STARTS IN</span>
                <strong>{gameState?.countdown || 5}</strong>
              </div>
            )}

            <div className="aviator-arena-tools">
              <button type="button" onClick={() => setMuted((v) => !v)} aria-label="Toggle sound">
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button type="button" onClick={() => setShowMenu(true)} aria-label="Open menu"><Menu size={17} /></button>
              <button type="button" onClick={() => setShowChat(true)} aria-label="Open chat"><MessageCircle size={17} /></button>
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

            <div className="aviator-ref-bet-card">
              <div className="aviator-ref-tabs"><span>BET</span><span className="active">AUTO</span></div>
              <div className="aviator-ref-card-body">
                <div className="aviator-auto-row"><span>AUTO CASHOUT</span><strong>2.00x</strong></div>
                <div className="aviator-auto-row"><span>AUTO BET</span><b>OFF</b></div>
                <div className="aviator-ref-secondary-note">Visual slot preserved from the reference UI. Your current server supports one active bet per player.</div>
                {placeButton(true)}
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
