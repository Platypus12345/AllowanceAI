import React from 'react';

/**
 * AppLayout – a global layout wrapper that applies the dark‑indigo background,
 * glass‑morphism surface, and ensures the ambient background blobs are rendered.
 * All pages should be rendered inside this component to inherit the new UI skin.
 */
export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-app-bg text-text-primary relative overflow-hidden flex flex-col">
      {/* Ambient background blobs */}
      <div className="ambient-bg pointer-events-none -z-10">
        <div className="ambient-blob-1" />
        <div className="ambient-blob-2" />
        <div className="ambient-blob-3" />
      </div>

      {children}
    </div>
  );
}
