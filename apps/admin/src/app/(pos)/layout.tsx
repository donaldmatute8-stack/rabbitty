import React from "react";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-black text-white select-none">
      {/* Dark modern background for POS and Kiosk */}
      <div className="absolute top-0 right-0 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-purple-500/10 blur-[150px] pointer-events-none" />
      
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
