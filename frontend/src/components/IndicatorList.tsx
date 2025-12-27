"use client";

import { cn } from "@/lib/utils";
import type { Indicator } from "@/types";

interface IndicatorListProps {
  indicators: Indicator[];
  chartIndicators: Set<string>;
  focusedId: string | null;
  onFocus: (id: string) => void;
  onToggleChart: (id: string) => void;
}

export function IndicatorList({
  indicators,
  chartIndicators,
  focusedId,
  onFocus,
  onToggleChart,
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
          const isFocused = focusedId === ind.id;

          return (
            <div
              key={ind.id}
              onClick={() => onFocus(ind.id)}
              className={cn(
                "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                "hover:bg-[#22303f]",
                isCharted && "bg-cyan-400/10 border-l-2 border-l-cyan-400",
                isFocused && "ring-1 ring-cyan-400/40 ring-inset"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{ind.name || ind.id}</p>
                    <button
                      type="button"
                      aria-label={
                        isCharted
                          ? `Remove ${ind.id} from chart`
                          : `Add ${ind.id} to chart`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleChart(ind.id);
                      }}
                      className={cn(
                        "ml-1 inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                        isCharted
                          ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25"
                          : "border-[#2d3a50] bg-[#111827] text-[#64748b] hover:bg-[#1a2234]"
                      )}
                      title={
                        isCharted
                          ? "On chart (click to remove)"
                          : "Add to chart"
                      }
                    >
                      {isCharted ? (
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 5.29a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414l2.543 2.543 6.543-6.543a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
                        </svg>
                      )}
                    </button>
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
