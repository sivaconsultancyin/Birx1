import React from 'react';
import { X, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  rules: { heading: string; description: string }[];
  payouts?: { bet: string; payout: string }[];
}

export const RulesModal: React.FC<RulesModalProps> = ({
  isOpen,
  onClose,
  title,
  rules,
  payouts
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="rules-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="rules-modal-content"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">{title} Rules</h3>
          </div>
          <button
            id="btn-close-rules"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {payouts && payouts.length > 0 && (
            <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3">
              <h4 className="text-[11px] uppercase font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Payout Table
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {payouts.map((p, idx) => (
                  <div key={idx} className="flex justify-between bg-slate-900 px-2 py-1 rounded border border-slate-800/80">
                    <span className="text-slate-400">{p.bet}</span>
                    <span className="font-bold text-amber-300">{p.payout}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rules.map((r, idx) => (
              <div key={idx} className="border-l-2 border-amber-500/60 pl-3">
                <h5 className="font-bold text-slate-200">{r.heading}</h5>
                <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{r.description}</p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-[11px] text-amber-300/90">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <p>
              Server-authoritative fairness guaranteed. Results are cryptographically determined on the Brix gaming engine.
            </p>
          </div>
        </div>

        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <button
            id="btn-understand-rules"
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
