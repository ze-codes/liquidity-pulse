"use client";

export function Header() {
  return (
    <header className="flex items-center justify-between mb-8 pb-6 border-b border-[#2d3a50]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xl">
          💧
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Liquidity Pulse
        </h1>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a2234] border border-[#2d3a50] rounded-full text-sm text-[#94a3b8]">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        Live Data
      </div>
    </header>
  );
}
