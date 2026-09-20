import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface WinLossNotificationPayload {
  type: 'win' | 'loss';
  amount: number;
  id?: string;
}

const EVENT_NAME = 'brix_win_loss_notification';

/**
 * Global authoritative helper to trigger a win/loss notification popup
 * from any game screen upon receiving authoritative server settlement.
 */
export function notifyWinLoss(payload: WinLossNotificationPayload): void {
  if (typeof window === 'undefined') return;
  const event = new CustomEvent<WinLossNotificationPayload>(EVENT_NAME, {
    detail: {
      ...payload,
      amount: Math.max(0, Math.round(payload.amount || 0)),
      id: payload.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    }
  });
  window.dispatchEvent(event);
}

export const WinLossNotification: React.FC = () => {
  const [current, setCurrent] = useState<WinLossNotificationPayload | null>(null);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleNotification = (e: Event) => {
      const customEvent = e as CustomEvent<WinLossNotificationPayload>;
      if (!customEvent.detail) return;

      clearTimer();
      // Set new notification immediately (replaces any previous one, no stack)
      setCurrent(customEvent.detail);

      // Auto-dismiss within 1 second: display for 700ms, then trigger exit animation (200ms)
      dismissTimerRef.current = setTimeout(() => {
        setCurrent(null);
      }, 700);
    };

    window.addEventListener(EVENT_NAME, handleNotification);

    return () => {
      window.removeEventListener(EVENT_NAME, handleNotification);
      clearTimer();
    };
  }, [clearTimer]);

  return (
    <div
      id="global-win-loss-container"
      className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none flex justify-center w-auto max-w-[92vw]"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.id || `${current.type}-${current.amount}`}
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{
              duration: 0.16,
              ease: [0.22, 1, 0.36, 1]
            }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/95 border border-emerald-500/60 shadow-[0_4px_20px_rgba(16,185,129,0.35)] backdrop-blur-md"
          >
            {/* Green glowing indicator dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />

            {/* Clean Arrow Icon */}
            {current.type === 'win' ? (
              <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-3 h-3 text-emerald-300 stroke-[3]" />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full bg-emerald-900/60 flex items-center justify-center shrink-0">
                <ArrowDownRight className="w-3 h-3 text-emerald-400/80 stroke-[3]" />
              </div>
            )}

            {/* Short result message in clean green theme */}
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                {current.type === 'win' ? 'WIN' : 'LOSS'}
              </span>
              <span className="text-xs font-black font-mono text-emerald-400 tracking-tight">
                {current.type === 'win'
                  ? `+₹${(Number(current.amount) || 0).toLocaleString('en-IN')}`
                  : `-₹${(Number(current.amount) || 0).toLocaleString('en-IN')}`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
