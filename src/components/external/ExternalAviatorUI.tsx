import React from 'react';

export const ExternalAviatorUI: React.FC<{children: React.ReactNode}> = ({ children }) => (
  <section
    id="aviator-ui-shell"
    aria-label="Aviator game visual arena"
    className="aviator-shell relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-b from-indigo-950 via-slate-950 to-black shadow-2xl p-3"
  >
    <div className="aviator-stars" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ ['--i' as any]: i }} />)}
    </div>

    <div className="aviator-cloud aviator-cloud-a" aria-hidden="true" />
    <div className="aviator-cloud aviator-cloud-b" aria-hidden="true" />
    <div className="aviator-cloud aviator-cloud-c" aria-hidden="true" />

    <div className="aviator-scanline" aria-hidden="true" />

    <div className="relative z-10">
      {children}
    </div>
  </section>
);
