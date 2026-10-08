import React, { useState } from 'react';
import { Clock, ShieldCheck, Volume2, VolumeX, Menu, MessageCircle, Users, TrendingUp } from 'lucide-react';
import type { Wallet } from '../../types.ts';
import { NagyfAviatorScene } from './components/NagyfAviatorScene';
import { useAviatorGame } from './hooks/useAviatorGame';
import { GameHeader } from '../../../src/components/GameHeader.tsx';
import { RulesModal } from '../../../src/components/RulesModal.tsx';
import './aviator-source-ui.css';

interface AviatorScreenProps {
  wallet: Wallet;
  onUpdateWallet: (w: Wallet) => void;
  onBack: () => void;
  onOpenWallet?: () => void;
}

const demoPlayers = [
  ['SkyPilot', '1.42x'], ['AeroFox', '2.18x'], ['Cloud9', '3.06x'], ['NovaJet', '1.17x'],
  ['BlueWing', '4.21x'], ['Falcon', '1.83x'], ['Orbit', '5.44x'], ['JetStream', '2.71x']
];

export const AviatorScreen: React.FC<AviatorScreenProps> = ({ wallet, onUpdateWallet, onBack, onOpenWallet }) => {
  const { gameState, currentBet, loading, errorMsg, placeBet, cashOut, setErrorMsg } = useAviatorGame(wallet, onUpdateWallet);
  const [betAmount, setBetAmount] = useState(100);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const multiplier = gameState?.multiplier || 1;
  const phase = gameState?.phase || 'betting';
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';

  const placeButton = (secondary = false) => (
    <button type="button" disabled={secondary || loading || phase !== 'betting'}
      onClick={secondary ? undefined : () => void placeBet(betAmount)}
      className={`aviator-ref-action ${secondary ? 'aviator-ref-action-muted' : 'aviator-ref-action-bet'}`}>
      {secondary ? 'SECOND SLOT' : phase === 'betting' ? `PLACE BET · ₹${betAmount.toLocaleString('en-IN')}` : 'WAITING FOR NEXT ROUND'}
    </button>
  );

  const cashoutButton = (
    <button id="btn-aviator-cashout" type="button" disabled={loading} onClick={() => void cashOut()} className="aviator-ref-action aviator-ref-action-cashout">
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
            <NagyfAviatorScene
              phase={phase}
              multiplier={multiplier}
              crashMultiplier={gameState?.crashMultiplier ?? null}
              countdown={Number(gameState?.countdown || 0)}
            />

            <div className="aviator-arena-overlay">
              <div className="aviator-arena-top">
                <span className="aviator-round-id">ROUND {gameState?.roundId || 'AV-SYNC'}</span>
                <span className={`aviator-status ${isRunning ? 'running' : isCrashed ? 'crashed' : 'waiting'}`}>
                  {isRunning ? 'FLYING AWAY' : isCrashed ? `FLEW AWAY · ${(gameState?.crashMultiplier || multiplier).toFixed(2)}x` : `NEXT FLIGHT · ${gameState?.countdown || 5}s`}
                </span>
              </div>

              <div className={`aviator-reference-multiplier ${isCrashed ? 'crashed' : ''}`}>
                {isCrashed && <div className="aviator-flew-away">FLEW AWAY</div>}
                <strong>{isCrashed ? (gameState?.crashMultiplier || multiplier).toFixed(2) : isRunning ? multiplier.toFixed(2) : '1.00'}x</strong>
                {!isRunning && !isCrashed && <span>WAITING FOR TAKEOFF</span>}
              </div>

              {!isRunning && !isCrashed && (
                <div className="aviator-takeoff">
                  <span>FLIGHT STARTS IN</span>
                  <strong>{gameState?.countdown || 5}</strong>
                </div>
              )}
            </div>

            <div className="aviator-arena-tools">
              <button type="button" onClick={() => setMuted((v) => !v)} aria-label="Toggle sound">
                {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <button type="button" onClick={() => setShowMenu(true)} aria-label="Open menu"><Menu size={17} /></button>
              <button type="button" onClick={() => setShowChat(true)} aria-label="Open chat"><MessageCircle size={17} /></button>
            </div>
          </section>

          {errorMsg && <div className="aviator-reference-error" role="alert" onClick={() => setErrorMsg(null)}>{errorMsg}</div>}

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
