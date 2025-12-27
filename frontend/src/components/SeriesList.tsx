"use client";

import { cn } from "@/lib/utils";
import type { Series } from "@/types";

interface SeriesListProps {
  groupedSeries: Record<string, Series[]>;
  chartSeries: Set<string>;
  totalCount: number;
  onSelect: (id: string) => void;
}

export function SeriesList({
  groupedSeries,
  chartSeries,
  totalCount,
  onSelect,
}: SeriesListProps) {
  return (
    <div className="rounded-xl border border-[#2d3a50] bg-[#1a2234] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#2d3a50] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-400/20">
          <svg
            className="h-3.5 w-3.5 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7z"
            />
          </svg>
        </div>
        <h3 className="font-medium">Data Series</h3>
        <span className="ml-auto text-xs text-[#64748b]">{totalCount}</span>
      </div>
      <div className="max-h-[350px] overflow-y-auto">
        {Object.entries(groupedSeries).map(([source, items]) => (
          <div key={source}>
            <div className="sticky top-0 bg-[#111827] px-4 py-1.5 z-10">
              <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                {source}
              </span>
            </div>
            {items.map((s) => {
              const isCharted = chartSeries.has(s.id);

              return (
                <div
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                    "hover:bg-[#22303f]",
                    isCharted &&
                      "bg-purple-400/10 border-l-2 border-l-purple-400"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm font-mono">{s.id}</p>
                    {isCharted && (
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[#64748b]">{s.name}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
