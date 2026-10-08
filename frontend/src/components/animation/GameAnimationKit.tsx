import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { gsap } from 'gsap';
import * as PIXI from 'pixi.js';
import Lottie from 'lottie-react';
import { useRive, Layout, Fit } from '@rive-app/react-canvas';

export function useGsapTimeline(active = true) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active || !ref.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 10, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' });
    }, ref);
    return () => ctx.revert();
  }, [active]);
  return ref;
}

export const MotionCard = ({ children, className = '', ...props }: React.ComponentProps<typeof motion.div>) => (
  <motion.div
    {...props}
    className={className}
    initial={{ opacity: 0, y: 8, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const ParticleCanvas: React.FC<{ active?: boolean; className?: string }> = ({ active = true, className = '' }) => {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active || !host.current) return;
    const app = new PIXI.Application();
    let disposed = false;
    (async () => {
      await app.init({ resizeTo: host.current!, antialias: true, backgroundAlpha: 0 });
      if (disposed || !host.current) { app.destroy(true); return; }
      host.current.appendChild(app.canvas);
      const particles = Array.from({ length: 28 }, () => {
        const g = new PIXI.Graphics().circle(0, 0, Math.random() * 2 + 1).fill(0xffffff);
        g.x = Math.random() * app.screen.width;
        g.y = Math.random() * app.screen.height;
        g.alpha = Math.random() * 0.6 + 0.2;
        app.stage.addChild(g);
        return g;
      });
      app.ticker.add(() => {
        particles.forEach(p => { p.y -= 0.35; if (p.y < -4) p.y = app.screen.height + 4; });
      });
    })();
    return () => { disposed = true; app.destroy(true); };
  }, [active]);
  return <div ref={host} className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true" />;
};

export const LottieEffect: React.FC<{ animationData?: object; className?: string }> = ({ animationData, className = '' }) =>
  animationData ? <Lottie animationData={animationData} loop className={className} /> : null;

export const RiveEffect: React.FC<{ src?: string; className?: string }> = ({ src, className = '' }) => {
  const { RiveComponent } = useRive({ src: src || '', autoplay: !!src, layout: new Layout({ fit: Fit.Contain }) });
  return src ? <RiveComponent className={className} /> : null;
};
