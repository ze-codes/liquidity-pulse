"use client";

import { cn } from "@/lib/utils";
import type { Indicator } from "@/types";

interface IndicatorListProps {
  indicators: Indicator[];
  chartIndicators: Set<string>;
  onSelect: (id: string) => void;
}

export function IndicatorList({
  indicators,
  chartIndicators,
  onSelect,
}: IndicatorListProps) {
  return (
    <div className="rounded-xl border border-[#2d3a50] bg-[#1a2234] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#2d3a50] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-400/20">
          <svg
            className="h-3.5 w-3.5 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>
        <h3 className="font-medium">Indicators</h3>
        <span className="ml-auto text-xs text-[#64748b]">
          {indicators.length}
        </span>
      </div>
      <div className="max-h-[350px] overflow-y-auto">
        {indicators.map((ind) => {
          const isCharted = chartIndicators.has(ind.id);

          return (
            <div
              key={ind.id}
              onClick={() => onSelect(ind.id)}
              className={cn(
                "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                "hover:bg-[#22303f]",
                isCharted && "bg-cyan-400/10 border-l-2 border-l-cyan-400"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{ind.name || ind.id}</p>
                    {isCharted && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#64748b] font-mono">
                    {ind.id}
                  </p>
                </div>
                <span className="shrink-0 rounded bg-[#111827] px-1.5 py-0.5 text-xs text-[#64748b]">
                  {ind.series?.length || 0} series
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
