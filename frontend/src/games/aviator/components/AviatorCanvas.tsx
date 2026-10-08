import React, { useEffect, useMemo, useRef } from 'react';
import { CanvasRenderer } from './renderer/CanvasRenderer.js';
import { GameState } from './engine/GameStates.js';
import { SoundEngine } from './audio/SoundEngine.js';

type Props = {
  phase: string;
  multiplier: number;
  crashMultiplier?: number | null;
  countdown?: number;
  muted?: boolean;
  onToggleMute?: () => void;
};

export const AviatorCanvas: React.FC<Props> = ({
  phase,
  multiplier,
  crashMultiplier,
  countdown = 5,
  muted = false,
  onToggleMute
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const latestRef = useRef({ phase, multiplier, crashMultiplier, countdown });
  const flightTimeRef = useRef(0);
  const previousPhaseRef = useRef(phase);
  const soundRef = useRef<SoundEngine | null>(null);

  latestRef.current = { phase, multiplier, crashMultiplier, countdown };

  const visualState = useMemo(() => ({
    currentState: phase === 'running' ? GameState.FLYING : phase === 'crashed' ? GameState.CRASHED : GameState.BETTING,
    multiplier: Math.max(1, multiplier),
    crashMultiplier: Math.max(1.01, Number(crashMultiplier ?? Math.max(10, multiplier + 1))),
    currentFlightTimeMs: 0,
    countdownRemainingMs: Math.max(0, countdown * 1000),
  }), [phase, multiplier, crashMultiplier, countdown]);

  useEffect(() => {
    const sound = new SoundEngine();
    soundRef.current = sound;
    sound.setVolume(muted ? 0 : 0.5);
    return () => { sound.dispose(); soundRef.current = null; };
  }, [muted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const renderer = new CanvasRenderer(canvas);
    rendererRef.current = renderer;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) renderer.resize(rect.width, rect.height);
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let raf = 0;
    let last = performance.now();
    let flightTime = 0;
    let lastServerMultiplier = 1;

    const frame = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const s = latestRef.current;

      if (s.phase === 'running') {
        const serverMultiplier = Math.max(1, Number(s.multiplier || 1));
        const crash = Math.max(1.01, Number(s.crashMultiplier ?? Math.max(10, serverMultiplier + 1)));
        const targetFlightTime = renderer.getFlightPath().multiplierToFlightTime(serverMultiplier, crash);
        // Follow the authoritative server position while interpolating only
        // the visual time, preventing drift between curve and multiplier.
        if (serverMultiplier < lastServerMultiplier) {
          flightTime = targetFlightTime;
        } else {
          const follow = 1 - Math.exp(-dt / 70);
          flightTime += (targetFlightTime - flightTime) * follow;
          if (Math.abs(targetFlightTime - flightTime) < 1) flightTime = targetFlightTime;
        }
        lastServerMultiplier = serverMultiplier;
      } else if (s.phase === 'crashed') {
        const serverMultiplier = Math.max(1, Number(s.crashMultiplier || s.multiplier || 1));
        const crash = Math.max(1.01, Number(s.crashMultiplier || serverMultiplier));
        flightTime = renderer.getFlightPath().multiplierToFlightTime(serverMultiplier, crash);
        lastServerMultiplier = serverMultiplier;
      } else {
        flightTime = 0;
        lastServerMultiplier = 1;
      }
      flightTimeRef.current = flightTime;

      const state = {
        ...visualState,
        currentState: s.phase === 'running' ? GameState.FLYING : s.phase === 'crashed' ? GameState.CRASHED : GameState.BETTING,
        multiplier: Math.max(1, Number(s.multiplier || 1)),
        crashMultiplier: Math.max(1.01, Number(s.crashMultiplier ?? Math.max(10, Number(s.multiplier || 1) + 1))),
        currentFlightTimeMs: flightTime,
        countdownRemainingMs: Math.max(0, Number(s.countdown || 0) * 1000),
      };

      renderer.render(state as any, dt, now);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sound = soundRef.current;
    if (sound) {
      sound.setVolume(muted ? 0 : 0.5);
      if (previousPhaseRef.current !== phase && phase === 'running') sound.flightStart();
      if (previousPhaseRef.current !== phase && phase === 'crashed') sound.crash();
      if (phase === 'running') sound.updateMultiplier(Number(multiplier || 1));
    }
    if (previousPhaseRef.current !== phase && phase === 'crashed') {
      const renderer = rendererRef.current;
      if (renderer) {
        const state: any = {
          currentState: GameState.CRASHED,
          multiplier: Math.max(1, multiplier),
          crashMultiplier: Math.max(1.01, Number(crashMultiplier ?? multiplier)),
          currentFlightTimeMs: flightTimeRef.current,
        };
        const path = renderer.getFlightPath();
        const pos = path.getPlanePosition(state.currentFlightTimeMs, state.crashMultiplier);
        renderer.triggerCrashEffect(pos.x, pos.y);
      }
    }
    previousPhaseRef.current = phase;
  }, [phase, multiplier, crashMultiplier]);

  return (
    <div ref={hostRef} className="aviator-reference-canvas-host">
      <canvas ref={canvasRef} className="aviator-reference-canvas" aria-label="Aviator flight animation" />

    </div>
  );
};
