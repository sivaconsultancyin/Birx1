import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Film, Sparkles, AlertCircle } from 'lucide-react';
import { RealisticLiveShuffleEngine } from './RealisticLiveShuffleEngine.tsx';

interface RealHumanShuffleVideoProps {
  isShuffling: boolean;
  roundId?: string;
  gameTitle?: string;
  durationSeconds?: number;
  onShuffleFinished?: () => void;
  className?: string;
}

export const RealHumanShuffleVideo: React.FC<RealHumanShuffleVideoProps> = ({
  isShuffling,
  roundId,
  gameTitle = 'Live Dealer Shuffle',
  durationSeconds = 10,
  onShuffleFinished,
  className = ''
}) => {
  const [videoUrl, setVideoUrl] = useState<string>('/assets/videos/human_dealer_shuffle_10s.mp4');
  const [isVideoAvailable, setIsVideoAvailable] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isStorageConfigured, setIsStorageConfigured] = useState<boolean>(false);
  const [videoElapsed, setVideoElapsed] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch authoritative video asset info from Supabase Storage / Server
  useEffect(() => {
    let isMounted = true;
    async function fetchVideoInfo() {
      try {
        const res = await fetch('/api/storage/shuffle-video');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            if (data.url) setVideoUrl(data.url);
            setIsStorageConfigured(Boolean(data.configured || data.isStorageBacked));
          }
        }
      } catch {
        // use default path
      }
    }
    fetchVideoInfo();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Play / Pause based on server-authoritative isShuffling state
  useEffect(() => {
    if (isShuffling) {
      setVideoElapsed(0);
      setHasError(false);
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsVideoAvailable(true);
            })
            .catch(() => {
              // Video failed to play or asset missing
              setIsVideoAvailable(false);
              setHasError(true);
            });
        }
      }
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [isShuffling]);

  // Video time update ticker
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setVideoElapsed(Math.round(videoRef.current.currentTime));
    }
  };

  const handleVideoEnded = () => {
    if (onShuffleFinished) onShuffleFinished();
  };

  const handleVideoError = () => {
    setIsVideoAvailable(false);
    setHasError(true);
  };

  if (!isShuffling) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={`shuffle-container-${roundId || 'active'}`}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className={`relative w-full rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-neutral-950 shadow-[0_15px_40px_rgba(0,0,0,0.9)] ${className}`}
      >
        {/* If video is ready and available */}
        <div className={`relative w-full ${isVideoAvailable && !hasError ? 'block' : 'hidden'}`}>
          <video
            ref={videoRef}
            src={videoUrl}
            playsInline
            muted
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            className="w-full h-48 sm:h-56 object-cover object-center filter brightness-[1.05] contrast-[1.05]"
          />
          {/* Subtle Studio Overlay Banner */}
          <div className="absolute top-2 left-3 right-3 flex items-center justify-between text-xs z-20 pointer-events-none">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 border border-amber-500/50 text-amber-200 font-medium backdrop-blur-md shadow-lg">
              <Film className="w-3.5 h-3.5 text-red-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Real Human Shuffle ({videoElapsed}s / {durationSeconds}s)
              </span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[9px] font-mono">
              Live Dealer Studio
            </div>
          </div>
        </div>

        {/* Seamless Fallback: If video asset is not yet uploaded or fails to stream */}
        {(!isVideoAvailable || hasError) && (
          <div className="relative w-full">
            {/* Render the realistic physical shuffle animation engine */}
            <RealisticLiveShuffleEngine
              onComplete={onShuffleFinished}
              className="w-full"
            />

            {/* Non-intrusive Asset Slot Status Indicator */}
            <div className="px-3 py-1.5 bg-black/90 border-t border-amber-500/30 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">{gameTitle} • Real Dealer Shuffle</span>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-mono text-slate-400" title="Supabase Storage video asset ready">
                <Video className="w-3 h-3 text-amber-400" />
                <span>Supabase: game-assets/human_dealer_shuffle_10s.mp4</span>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
