import React from 'react';
import { Loader2, AlertTriangle, Inbox, CheckCircle2 } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading game engine...' }) => (
  <div id="state-loading" className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="relative mb-3">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      <span className="absolute inset-0 rounded-full blur-md bg-amber-500/20" />
    </div>
    <p className="text-xs font-semibold text-slate-300 tracking-wide">{message}</p>
  </div>
);

export const ErrorState: React.FC<{ message?: string; onRetry?: () => void }> = ({
  message = 'Failed to communicate with server',
  onRetry
}) => (
  <div id="state-error" className="flex flex-col items-center justify-center py-10 px-4 text-center">
    <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
      <AlertTriangle className="w-6 h-6" />
    </div>
    <p className="text-xs text-rose-300 font-medium mb-3 max-w-xs">{message}</p>
    {onRetry && (
      <button
        id="btn-retry"
        type="button"
        onClick={onRetry}
        className="py-1.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition-colors cursor-pointer"
      >
        Retry
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div id="state-empty" className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
      <Inbox className="w-6 h-6" />
    </div>
    <h4 className="text-xs font-bold text-slate-300">{title}</h4>
    {subtitle && <p className="text-[11px] text-slate-500 mt-1 max-w-xs">{subtitle}</p>}
  </div>
);

export const ConfirmationDialog: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="confirmation-dialog-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        id="confirmation-dialog-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-center"
      >
        <h4 className="text-sm font-black text-white mb-2">{title}</h4>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
