"use client";

import { RefObject } from "react";

interface ChartProps {
  chartRef: RefObject<HTMLDivElement | null>;
  chartIndicators: Set<string>;
  chartSeries: Set<string>;
  days: number;
  setDays: (days: number) => void;
  isLoading: boolean;
  onClear: () => void;
}

export function Chart({
  chartRef,
  chartIndicators,
  chartSeries,
  days,
  setDays,
  isLoading,
  onClear,
}: ChartProps) {
  const totalSelected = chartIndicators.size + chartSeries.size;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e2e8f0]">Chart</h2>
          <p className="text-sm text-[#64748b]">
            {totalSelected > 0
              ? `${chartIndicators.size} indicators, ${chartSeries.size} series selected`
              : "Add items from the explorer above to chart them"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#64748b] font-medium">Days:</label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 90)}
              min={7}
              max={365}
              className="w-20 px-3 py-1.5 bg-[#1a2234] border border-[#2d3a50] rounded-lg font-mono text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 outline-none"
            />
          </div>
          {totalSelected > 0 && (
            <button
              onClick={onClear}
              className="px-3 py-1.5 bg-[#2d3a50] text-[#94a3b8] rounded-lg text-sm hover:bg-[#3d4a60] transition-all"
            >
              Clear Chart
            </button>
          )}
        </div>
      </div>

      <div className="relative bg-[#1a2234] border border-[#2d3a50] rounded-2xl p-6">
        <div ref={chartRef} className="w-full h-[450px]" />
        {isLoading && (
          <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-[#111827] border border-[#2d3a50] rounded-lg text-xs text-[#94a3b8]">
            <div className="w-3.5 h-3.5 border-2 border-[#2d3a50] border-t-cyan-400 rounded-full animate-spin" />
            Refreshing...
          </div>
        )}
        {totalSelected === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#64748b] text-sm">
              Select items from the Relationship Explorer to visualize
            </p>
          </div>
        )}
        <p className="text-center text-[#64748b] text-xs mt-2">
          Scroll to zoom • Drag to pan • Double-click to reset
        </p>
      </div>
    </section>
  );
}
