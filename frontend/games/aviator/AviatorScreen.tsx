import React, { useEffect, useRef, useState } from 'react';
import { Clock, Plane, ShieldCheck, Volume2, VolumeX, Menu, MessageCircle, Users, TrendingUp } from 'lucide-react';
import { AviatorBet, AviatorState, Wallet } from '../../../src/types.ts';
import { gamesApi, subscribeToGameRealtimeEvents } from '../../../src/api/client.ts';
import { GameHeader } from '../../../src/components/GameHeader.tsx';
import { RulesModal } from '../../../src/components/RulesModal.tsx';
import { AviatorReferenceCanvas } from './AviatorReferenceCanvas';
import { notifyWinLoss } from '../../../src/components/WinLossNotification.tsx';
import './aviator-source-ui.css';

interface AviatorScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

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

    const unsubscribe = subscribeToGameRealtimeEvents('aviator', (payload) => {
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
    if (!gameState || gameState.phase !== 'betting') return;
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
      setCurrentBet((prev) => prev ? { ...prev, cashedOut: true, winAmount: res.winAmount } : null);
      notifyWinLoss({ type: 'win', amount: res.winAmount, id: `aviator-win-${currentBet.betId}` });
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

    return (
    <div id="screen-aviator" className="aviator-source-app-shell">
      <div className="aviator-source-game-layout">
        <aside className="aviator-source-left-sidebar">
          <div className="aviator-source-bet-table">
            <div className="aviator-source-player-count-header">
              <Users size={16} />
              <span className="aviator-source-player-count-text">
                {Math.max(0, Number((gameState as any)?.bets?.length ?? 0))} Bets
              </span>
            </div>
            <div className="aviator-source-bet-table-tabs">
              <button className="aviator-source-bet-tab active" type="button">All Bets</button>
              <button className="aviator-source-bet-tab" type="button">Previous</button>
              <button className="aviator-source-bet-tab" type="button">Top</button>
            </div>
            <div className="aviator-source-bet-table-header">
              <span></span><span>BETS</span><span>PAYOUT</span><span>CASHED OUT</span>
            </div>
            <div className="aviator-source-bet-table-body">
              {(((gameState as any)?.bets ?? []) as Array<any>).map((bet, i) => (
                <div className={`aviator-source-bet-row ${bet.cashedOut ? 'cashed' : 'crashed'}`} key={bet.betId || i}>
                  <span className="aviator-source-player-cell">
                    <span className="aviator-source-player-avatar-sm" style={{background:'#8855ff',width:'24px',height:'24px'}} />
                    Player {i + 1}
                  </span>
                  <span>{Number(bet.amount ?? 0).toFixed(2)}</span>
                  <span className="aviator-source-multiplier-cell">
                    {bet.cashedOut ? `${Number(bet.cashOutMultiplier ?? 0).toFixed(2)}x` : '—'}
                  </span>
                  <span className="aviator-source-win-cell">
                    {bet.cashedOut ? Number(bet.winAmount ?? 0).toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="aviator-source-main-area">
          <div className="aviator-source-history-bar">
            {(gameState?.previousMultipliers || []).slice(0, 15).map((m, i) => (
              <span key={`h-${m}-${i}`} className={m < 2 ? 'red' : m >= 10 ? 'pink' : 'green'}>
                {m.toFixed(2)}x
              </span>
            ))}
          </div>

          <div className="aviator-source-game-canvas-wrapper">
            <AviatorReferenceCanvas
              phase={phase}
              multiplier={multiplier}
              crashMultiplier={gameState?.crashMultiplier}
              countdown={gameState?.countdown}
              muted={muted}
              onToggleMute={() => setMuted(v => !v)}
            />

            <div className="aviator-source-game-overlay">
              <div className="aviator-source-multiplier-display">
                {isCrashed && <div className="aviator-source-flew-away-text">FLEW AWAY</div>}
                <div className={`aviator-source-multiplier-value ${isCrashed ? 'crashed' : ''}`}>
                  {(isCrashed ? Number(gameState?.crashMultiplier ?? multiplier) : multiplier).toFixed(2)}x
                </div>
              </div>

              <div className="aviator-source-balance-display">
                <span className="aviator-source-balance-label">Balance</span>
                <span className="aviator-source-balance-value">₹{wallet.balance.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</span>
              </div>

              <button className="aviator-source-mute-btn" type="button" onClick={() => setMuted(v => !v)}>
                {muted ? '🔇' : '🔊'}
              </button>
              <button className="aviator-source-menu-btn" type="button" onClick={() => setShowMenu(true)}>☰</button>

              <div className="aviator-source-player-count-overlay">
                <div className="aviator-source-avatar-cluster">
                  <div className="aviator-source-avatar" style={{background:'#8855ff'}} />
                  <div className="aviator-source-avatar" style={{background:'#ff8800'}} />
                  <div className="aviator-source-avatar" style={{background:'#00ff88'}} />
                </div>
                <span className="aviator-source-player-count">
                  {Math.max(0, Number((gameState as any)?.bets?.length ?? 0))}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && <div className="aviator-source-error-message">{errorMsg}</div>}

          <div className="aviator-source-bet-panels-row">
            {[1, 2].map(slot => (
              <div className="aviator-source-bet-panel" key={slot}>
                <div className="aviator-source-bet-panel-tabs">
                  <button type="button" className="aviator-source-bet-panel-tab active">Bet</button>
                  <button type="button" className="aviator-source-bet-panel-tab">Auto</button>
                </div>
                <div className="aviator-source-bet-panel-body">
                  <div className="aviator-source-bet-amount-group">
                    <div className="aviator-source-bet-amount-stepper">
                      <button type="button" className="aviator-source-stepper-btn" onClick={() => setBetAmount(v => Math.max(1, v - 1))}>−</button>
                      <input className="aviator-source-bet-amount-input" value={betAmount} onChange={e => setBetAmount(Math.max(1, Number(e.target.value) || 1))} />
                      <button type="button" className="aviator-source-stepper-btn" onClick={() => setBetAmount(v => Math.min(25000, v + 1))}>+</button>
                    </div>
                    <div className="aviator-source-bet-quick-btns">
                      {[1, 2, 5, 10].map(n => <button type="button" key={n} className={`aviator-source-bet-quick-btn ${betAmount === n ? 'active' : ''}`} onClick={() => setBetAmount(n)}>{n}</button>)}
                    </div>
                  </div>
                  {slot === 1 && currentBet && !currentBet.cashedOut && isRunning ? (
                    <button id="btn-aviator-cashout" type="button" className="aviator-source-bet-action-btn cashout" onClick={handleCashout}>
                      CASH OUT
                      <span className="aviator-source-cashout-value">₹{Math.floor((currentBet.amount ?? 0) * multiplier).toLocaleString('en-IN')} · {multiplier.toFixed(2)}x</span>
                    </button>
                  ) : (
                    <button type="button" className="aviator-source-bet-action-btn bet" disabled={loading || phase !== 'betting'} onClick={handlePlaceBet}>
                      {phase === 'betting' ? `BET ₹${betAmount.toFixed(2)}` : 'WAITING FOR NEXT ROUND'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="aviator-source-footer-badges">
            <button type="button" className="aviator-source-provably-fair-badge" onClick={() => setShowRules(true)}>
              <ShieldCheck size={14} /><span>Provably Fair</span>
            </button>
            <div className="aviator-source-powered-by-badge"><span>Server</span><strong>Birx1 Aviator</strong></div>
          </div>
        </main>
      </div>

      {showMenu && (
        <div className="aviator-source-menu-backdrop" onClick={() => setShowMenu(false)}>
          <div className="aviator-source-settings-menu" onClick={e => e.stopPropagation()}>
            <div className="aviator-source-menu-header">
              <div className="aviator-source-player-info">
                <div className="aviator-source-player-avatar" style={{background:'#8855ff'}}>P</div>
                <div><span className="aviator-source-player-name">Aviator Player</span></div>
              </div>
            </div>
            <div className="aviator-source-menu-items">
              <button className="aviator-source-menu-item" type="button" onClick={() => setMuted(v => !v)}>{muted ? '🔇 Sound Off' : '🔊 Sound On'}</button>
              <button className="aviator-source-menu-item" type="button" onClick={() => {setShowRules(true);setShowMenu(false)}}>❓ How To Play</button>
              <button className="aviator-source-menu-item" type="button" onClick={() => {setShowRules(true);setShowMenu(false)}}>🛡 Provably Fair</button>
              <button className="aviator-source-menu-item" type="button" onClick={() => {setShowMenu(false);onBack()}}>🏠 Back</button>
            </div>
          </div>
        </div>
      )}

      <RulesModal isOpen={showRules} onClose={() => setShowRules(false)} title="Aviator" rules={[
        {heading:'Flight',description:'The multiplier rises while the server-authoritative flight is running.'},
        {heading:'Cash Out',description:'Cash out before the server crash to receive the current multiplier payout.'},
        {heading:'Fairness',description:'Round results are generated and settled by the backend.'}
      ]} />
    </div>
  );
};
