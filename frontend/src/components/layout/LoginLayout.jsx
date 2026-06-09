import React from 'react';

export default function LoginLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] p-4"
      style={{ background: 'linear-gradient(to bottom, #4a6cf7 50%, #f0f2f5 50%)' }}>
      {children}
    </div>
  );
}
