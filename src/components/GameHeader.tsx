import React from 'react';
import { ArrowLeft, BookOpen, Volume2, VolumeX } from 'lucide-react';
import { WalletBalance } from './WalletBalance.tsx';

interface GameHeaderProps {
  title: string;
  gameId: string;
  balance: number;
  isDemo?: boolean;
  roundId?: string;
  onBack: () => void;
  onOpenRules: () => void;
  onOpenWallet?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  title,
  gameId,
  balance,
  isDemo = true,
  roundId,
  onBack,
  onOpenRules,
  onOpenWallet
}) => {
  const [soundOn, setSoundOn] = React.useState(true);

  return (
    <div
      id={`game-header-${gameId}`}
      className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-slate-950/95 border-b border-slate-800/80 px-3 py-2.5 backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <button
          id={`btn-back-${gameId}`}
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-xl bg-slate-900 border border-slate-850 text-slate-300 hover:text-white hover:bg-slate-800 transition-transform active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-black text-white tracking-wide">{title}</h2>
            {roundId && (
              <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                #{roundId}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onOpenWallet ? (
          <div onClick={onOpenWallet} className="cursor-pointer">
            <WalletBalance balance={balance} isDemo={isDemo} size="sm" showAddBtn={false} />
          </div>
        ) : (
          <WalletBalance balance={balance} isDemo={isDemo} size="sm" showAddBtn={false} />
        )}

        <button
          id="btn-toggle-sound"
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title={soundOn ? 'Sound On' : 'Muted'}
        >
          {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />}
        </button>

        <button
          id="btn-game-rules"
          type="button"
          onClick={onOpenRules}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          title="Game Rules"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
