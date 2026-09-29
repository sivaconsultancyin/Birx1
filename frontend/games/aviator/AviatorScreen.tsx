import React, { useEffect, useRef, useState } from 'react';
import { History, Rocket, Trophy, Users, Wallet, Send, Settings } from 'lucide-react';
import { AviatorBet, AviatorState, Wallet as WalletType } from '../../../src/types.ts';
import { gamesApi } from '../../api/client.ts';
import { RulesModal } from '../../components/RulesModal.tsx';
import { notifyWinLoss } from '../../components/WinLossNotification.tsx';

interface AviatorScreenProps {
  wallet: WalletType;
  onUpdateWallet: (w: WalletType) => void;
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
  const currentBetRef = useRef<AviatorBet | null>(null);
  currentBetRef.current = currentBet;

  useEffect(() => {
    let mounted = true;
    const poll = setInterval(async () => {
      try {
        const res = await gamesApi.aviator.getState();
        if (!mounted) return;
        setGameState(res.state);
        if (res.state.phase === 'crashed') {
          if (currentBetRef.current && !currentBetRef.current.cashedOut) {
            notifyWinLoss({ type: 'loss', amount: currentBetRef.current.amount });
          }
          setCurrentBet(null);
        } else if (res.state.currentBet) {
          setCurrentBet(res.state.currentBet);
        } else if (res.state.phase === 'betting') {
          setCurrentBet(null);
        }
      } catch {
        // Keep the last authoritative server state during transient network jitter.
      }
    }, 180);
    return () => {
      mounted = false;
      clearInterval(poll);
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

  const handleCashOut = async () => {
    if (!currentBet || currentBet.cashedOut || gameState?.phase !== 'running') return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await gamesApi.aviator.cashOut();
      onUpdateWallet(res.wallet);
      setCurrentBet(prev => prev ? { ...prev, cashedOut: true, winAmount: res.winAmount, cashOutMultiplier: res.cashMultiplier } : null);
      notifyWinLoss({ type: 'win', amount: res.winAmount });
    } catch (err: any) {
      setErrorMsg(err.message || 'Cashout failed');
    } finally {
      setLoading(false);
    }
  };

  const multiplier = Number(gameState?.multiplier || 1);
  const phase = gameState?.phase || 'betting';
  const isRunning = phase === 'running';
  const isCrashed = phase === 'crashed';
  const history = gameState?.previousMultipliers || [];

  return (
    <div className="aviator-reference min-h-screen w-full bg-[#0f1115] text-[#f3f4f6] overflow-hidden">
      <header className="h-20 glass flex items-center justify-between px-5 md:px-8 border-b border-white/5 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-red-500 p-2.5 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-400 transition-all" aria-label="Back">
            <Rocket className="text-white fill-white" size={26} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter leading-none">AVIATOR</h1>
            <p className="text-[10px] font-bold text-red-500/80 uppercase tracking-widest mt-1">Real-time Flight</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-5">
          <button onClick={() => setShowRules(true)} className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl border border-white/5 transition-all">
            <Trophy className="text-amber-400" size={18} />
            <span className="font-bold text-xs uppercase tracking-widest">Fairness</span>
          </button>
          <button onClick={onOpenWallet} className="flex items-center gap-2 border-l border-white/10 pl-3 md:pl-5 text-right hover:opacity-80 transition-opacity">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Wallet</p>
              <div className="flex items-center gap-1.5">
                <Wallet className="text-emerald-400" size={16} />
                <span className="text-base md:text-lg font-black tabular-nums">₹{Number(wallet.balance || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <Send size={16} className="rotate-45 text-gray-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex gap-4 p-3 md:p-4 overflow-hidden min-h-[calc(100vh-80px)]">
        <aside className="hidden lg:flex w-72 flex-col gap-4 overflow-hidden">
          <div className="flex-1 glass rounded-3xl p-5 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-indigo-400" />
                <h3 className="font-bold uppercase tracking-wider text-xs">Live Bet</h3>
              </div>
              <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
                {currentBet ? '1 ACTIVE' : 'WAITING'}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {currentBet ? (
                <div className={`flex items-center justify-between p-3 rounded-2xl border ${currentBet.cashedOut ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                  <div>
                    <p className="text-xs font-bold text-gray-400">YOU</p>
                    <p className="text-sm font-black">₹{currentBet.amount.toLocaleString('en-IN')}</p>
                  </div>
                  {currentBet.cashedOut && (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-emerald-500">{currentBet.cashOutMultiplier?.toFixed(2)}x</p>
                      <p className="text-sm font-black text-emerald-400">+₹{Number(currentBet.winAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-gray-500 text-center py-8">No active bet</div>
              )}
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col gap-4 relative min-w-0">
          <div className="glass rounded-2xl p-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
            <History size={16} className="text-gray-500 mt-1 ml-2 shrink-0" />
            {history.slice(0, 12).map((h, i) => (
              <div key={`${h}-${i}`} className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${h > 2 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                {Number(h).toFixed(2)}x
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-[380px] glass rounded-[2.5rem] relative flex items-center justify-center overflow-hidden border border-white/5 bg-gradient-to-br from-black/20 to-transparent">
            <AviatorCanvas multiplier={multiplier} phase={phase} />

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              {phase === 'betting' && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin mb-5 mx-auto" />
                  <h2 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-[0.2em]">Next Round In</h2>
                  <p className="text-6xl md:text-7xl font-black text-white drop-shadow-2xl">{Math.max(0, Number(gameState?.countdown || 0))}s</p>
                </div>
              )}
              {isRunning && (
                <div className="text-center multiplier-animate">
                  <p className="text-7xl md:text-[10rem] font-black tabular-nums tracking-tighter drop-shadow-[0_0_50px_rgba(234,67,53,0.4)] text-white">
                    {multiplier.toFixed(2)}<span className="text-4xl md:text-5xl ml-2 text-red-500">x</span>
                  </p>
                </div>
              )}
              {isCrashed && (
                <div className="text-center animate-shake">
                  <div className="bg-red-500/20 px-10 md:px-16 py-8 md:py-10 rounded-[3rem] backdrop-blur-xl border border-red-500/30">
                    <h2 className="text-red-500 text-xl md:text-2xl font-black uppercase tracking-widest mb-2">Flew Away!</h2>
                    <p className="text-6xl md:text-8xl font-black text-white">{Number(gameState?.crashMultiplier || multiplier).toFixed(2)}x</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {errorMsg && <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium text-center">{errorMsg}</div>}

          <div className="glass rounded-[2.5rem] p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 items-stretch md:items-center border border-white/5 shrink-0">
            <div className="flex-1 space-y-3">
              <div className="flex justify-between items-center px-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Bet Amount</label>
                {currentBet && <span className="text-xs font-bold text-emerald-400">Active: ₹{currentBet.amount.toLocaleString('en-IN')}</span>}
              </div>
              <div className="flex gap-2">
                {[10, 50, 100, 500].map(amt => (
                  <button key={amt} onClick={() => setBetAmount(amt)} disabled={loading || !!(currentBet && !currentBet.cashedOut)} className={`flex-1 py-3 rounded-xl font-bold transition-all ${betAmount === amt ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'} disabled:opacity-50`}>
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input type="number" min={10} value={betAmount} onChange={e => setBetAmount(Math.max(10, Number(e.target.value) || 10))} disabled={loading || !!(currentBet && !currentBet.cashedOut)} className="w-full bg-[#1a1d23] border border-white/10 rounded-2xl py-3 md:py-4 px-6 text-xl font-black outline-none focus:border-red-500/50 transition-all text-center disabled:opacity-50" />
              </div>
            </div>

            <div className="w-full md:w-1/3 h-28 md:h-32">
              {isRunning && currentBet && !currentBet.cashedOut ? (
                <button onClick={handleCashOut} disabled={loading} className="w-full h-full bg-emerald-500 hover:bg-emerald-400 shadow-[0_10px_40px_rgba(16,185,129,0.4)] rounded-3xl flex flex-col items-center justify-center transition-all active:scale-95 disabled:opacity-60">
                  <span className="text-xs font-black text-emerald-900 mb-1">CASH OUT</span>
                  <span className="text-2xl md:text-3xl font-black text-white">₹{Math.floor(betAmount * multiplier).toLocaleString('en-IN')}</span>
                </button>
              ) : (
                <button onClick={handlePlaceBet} disabled={loading || phase !== 'betting' || !!(currentBet && !currentBet.cashedOut)} className={`w-full h-full rounded-3xl flex flex-col items-center justify-center transition-all active:scale-95 shadow-xl disabled:opacity-50 ${currentBet ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-red-500 hover:bg-red-400 text-white shadow-[0_10px_40px_rgba(234,67,53,0.4)]'}`}>
                  <span className="text-xl font-black uppercase tracking-tighter">{currentBet ? 'Waiting' : phase === 'betting' ? 'Place Bet' : 'Waiting'}</span>
                  {!currentBet && <span className="text-xs font-bold opacity-70">₹{betAmount}</span>}
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <RulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="Aviator"
        rules={[
          { heading: 'How Aviator Works', description: 'The aircraft takes off with an increasing multiplier starting at 1.00x. The flight curve is driven by the server-authoritative game state.' },
          { heading: 'Cashing Out', description: 'Cash out before the server crash event to settle the active round.' },
          { heading: 'Server Authority', description: 'Round state, crash point and settlement remain authoritative on the backend.' }
        ]}
      />
    </div>
  );
};

function AviatorCanvas({ multiplier, phase }: { multiplier: number; phase: AviatorState['phase'] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const multiplierRef = useRef(multiplier);
  const phaseRef = useRef(phase);
  multiplierRef.current = multiplier;
  phaseRef.current = phase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let width = 0;
    let height = 0;
    let points: {x:number;y:number}[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawRocket = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      const time = Date.now() / 100;
      const flameW = 20 + Math.sin(time) * 5;
      const grad = ctx.createRadialGradient(-10, 0, 0, -10, 0, flameW);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(-10, 0, flameW, flameW / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ea4335';
      ctx.beginPath();
      ctx.ellipse(10, 0, 30, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(15, -2, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(-10, -25); ctx.lineTo(10, -8); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 8); ctx.lineTo(-10, 25); ctx.lineTo(10, 8); ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const currentPhase = phaseRef.current;
      const m = multiplierRef.current;

      if (currentPhase === 'running') {
        const progress = Math.min(0.9, Math.max(0, (m - 1) / 10));
        const x = 50 + (width - 150) * progress;
        const y = (height - 50) - (height - 150) * progress;
        points.push({x, y});
        if (points.length > 200) points.shift();

        ctx.beginPath();
        ctx.strokeStyle = '#ea4335';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (points.length) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        ctx.lineTo(x, height);
        ctx.lineTo(points[0].x, height);
        const gradient = ctx.createLinearGradient(0, y, 0, height);
        gradient.addColorStop(0, 'rgba(234,67,53,0.2)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();

        drawRocket(x, y, -Math.PI / 6);
      } else {
        points = [];
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full absolute inset-0" aria-label="Aviator flight animation" />;
}

export default AviatorScreen;
