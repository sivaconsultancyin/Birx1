import React from 'react';
import { Clock, Volume2, VolumeX, ShieldCheck } from 'lucide-react';
import { RealisticDealerStudio, DealerActionState } from './RealisticDealerStudio.tsx';

interface RealisticCasinoTableProps {
  gameName: string;
  roundId: string;
  phaseLabel: string;
  phaseColor?: string;
  countdown: number;
  dealerActionState?: DealerActionState;
  activeDealer?: 'left' | 'right' | 'both';
  dealerStatusText?: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  children: React.ReactNode;
  shoeRef?: React.RefObject<HTMLDivElement>;
  className?: string;
  hideStudioHeader?: boolean;
}

export const RealisticCasinoTable: React.FC<RealisticCasinoTableProps> = ({
  gameName,
  roundId,
  phaseLabel,
  phaseColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  countdown,
  dealerActionState = 'idle',
  activeDealer = 'both',
  dealerStatusText,
  soundEnabled,
  onToggleSound,
  children,
  shoeRef,
  className = '',
  hideStudioHeader = false
}) => {
  return (
    <div className={`w-full flex flex-col items-center select-none ${className}`}>
      {/* ------------------------------------------------------------- */}
      {/* TOP: REALISTIC LIVE CASINO DEALER STUDIO (ELENA & MARCUS)     */}
      {/* ------------------------------------------------------------- */}
      {!hideStudioHeader && (
        <div className="w-full max-w-lg mb-[-10px] z-10">
          <RealisticDealerStudio
            actionState={dealerActionState}
            activeDealer={activeDealer}
            dealerStatusText={dealerStatusText}
            gameTitle={gameName}
            roundId={roundId}
            countdown={countdown}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* REALISTIC PHYSICAL CASINO CARD TABLE (MAHOGANY & EMERALD FELT) */}
      {/* ------------------------------------------------------------- */}
      <div className="relative w-full max-w-lg rounded-[28px] sm:rounded-[36px] border-[5px] sm:border-[6px] border-[#593012] bg-[#0d2a1b] shadow-[0_24px_65px_rgba(0,0,0,0.95),inset_0_2px_12px_rgba(255,255,255,0.14)] overflow-hidden">
        {/* Polished Lacquered Armrest Rim with Subtle Brass Rivets */}
        <div className="absolute inset-0 rounded-[22px] sm:rounded-[30px] border border-amber-600/30 pointer-events-none shadow-[inset_0_4px_16px_rgba(0,0,0,0.85)]" />
        
        {/* Brass Rivet Studs around Table Rim */}
        <div className="absolute top-2 left-3 w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-700 shadow-sm opacity-60" />
        <div className="absolute top-2 right-3 w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-700 shadow-sm opacity-60" />
        <div className="absolute bottom-2 left-3 w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-700 shadow-sm opacity-60" />
        <div className="absolute bottom-2 right-3 w-1.5 h-1.5 rounded-full bg-amber-400 border border-amber-700 shadow-sm opacity-60" />

        {/* High-Grade Emerald Casino Felt Texture */}
        <div className="relative w-full rounded-[22px] sm:rounded-[28px] bg-gradient-to-b from-[#062015] via-[#041910] to-[#02100a] p-3 sm:p-4 text-white overflow-hidden">
          {/* Subtle Fine Weave Pattern & Ambient Overhead Casino Spotlight */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.14),transparent_70%)] pointer-events-none" />
          <div className="absolute inset-2 rounded-[18px] border border-amber-500/15 pointer-events-none" />
          <div className="absolute inset-4 rounded-[14px] border border-amber-500/10 pointer-events-none" />

          {/* Luxury Watermark Crest */}
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none">
            <span className="text-6xl sm:text-7xl font-serif font-black tracking-widest text-amber-100">
              ROYAL CLUB
            </span>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* TABLE TOP BAR: ROUND ID, PHASE BADGE, COUNTDOWN & SOUND */}
          {/* ----------------------------------------------------------- */}
          <div className="relative z-20 flex items-center justify-between gap-1.5 mb-2">
            {/* Round ID with Proven Fair Shield */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 border border-amber-500/30 text-[11px] font-mono text-amber-300 shadow-sm backdrop-blur-sm">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>#{roundId || '0000'}</span>
            </div>

            {/* Game Phase Badge */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-black tracking-wider uppercase backdrop-blur-md shadow-md ${phaseColor}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{phaseLabel}</span>
            </div>

            {/* Right: Countdown Timer & Sound Toggle */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 border border-amber-500/30 text-[11px] font-bold text-amber-300 shadow-sm backdrop-blur-sm">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>{countdown}s</span>
              </div>

              <button
                type="button"
                onClick={onToggleSound}
                className="w-7 h-7 rounded-full bg-black/60 border border-amber-500/30 flex items-center justify-center text-amber-400 hover:text-amber-200 transition-colors shadow-sm cursor-pointer"
                title={soundEnabled ? 'Mute Table Audio' : 'Enable Table Audio'}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              </button>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* CASINO DEALER TRAY & SHOE (PHYSICAL STATION) */}
          {/* ----------------------------------------------------------- */}
          <div className="relative z-20 flex items-center justify-between px-2 py-1 mb-2 rounded-xl bg-black/40 border border-amber-500/20 shadow-inner">
            {/* Dealer Multi-Chip Rack */}
            <div className="flex items-center gap-1 select-none">
              <div className="flex flex-col gap-0.5">
                <div className="flex gap-1 items-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-red-600 to-red-900 border border-red-400/50 shadow-xs" />
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-blue-600 to-blue-900 border border-blue-400/50 shadow-xs" />
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-900 border border-emerald-400/50 shadow-xs" />
                  <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-br from-purple-600 to-purple-900 border border-purple-400/50 shadow-xs" />
                </div>
              </div>
              <span className="text-[9px] font-mono text-amber-400/70 ml-1 hidden sm:inline">
                Banker Tray
              </span>
            </div>

            {/* Certified Provably Fair Marker */}
            <span className="text-[9px] text-emerald-400/90 font-mono tracking-wider font-semibold">
              SERVER AUTHORITATIVE
            </span>

            {/* Acrylic Dealing Shoe (Origin of all dealt cards) */}
            <div
              ref={shoeRef}
              className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-950/80 border border-amber-500/40 shadow-md"
            >
              {/* Stacked Cards in Shoe */}
              <div className="relative w-8 h-10 rounded bg-gradient-to-br from-[#7a121d] to-[#240407] border border-amber-400/60 shadow-md flex items-center justify-center rotate-[-6deg]">
                <span className="text-amber-300 font-serif text-[9px] font-black">♠</span>
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[8px] font-bold text-amber-400 uppercase tracking-tighter">
                  SHOE
                </span>
                <span className="text-[8px] font-mono text-slate-400">52 Cards</span>
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------- */}
          {/* MAIN GAME AREA (CHILDREN) */}
          {/* ----------------------------------------------------------- */}
          <div className="relative z-20 w-full">{children}</div>
        </div>
      </div>
    </div>
  );
};
