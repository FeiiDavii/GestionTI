import React from 'react';

export default function LoginLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: 'var(--bg-app)',
        backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
      {children}
    </div>
  );
}
