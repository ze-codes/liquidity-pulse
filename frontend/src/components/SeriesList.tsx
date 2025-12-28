"use client";

import { cn } from "@/lib/utils";
import type { Series } from "@/types";

interface SeriesListProps {
  groupedSeries: Record<string, Series[]>;
  chartSeries: Set<string>;
  totalCount: number;
  focusedId: string | null;
  onFocus: (id: string) => void;
  onToggleChart: (id: string) => void;
  isLoading?: boolean;
}

function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="px-4 py-3 border-b border-[#2d3a50] last:border-0 animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-4 w-24 bg-[#2d3a50] rounded" />
          <div className="h-5 w-5 bg-[#2d3a50] rounded" />
        </div>
      </div>
      <div className="mt-1.5 h-3 w-40 bg-[#2d3a50]/60 rounded" />
    </div>
  );
}

function SkeletonGroup({ groupIndex }: { groupIndex: number }) {
  return (
    <div>
      <div className="sticky top-0 bg-[#111827] px-4 py-1.5 z-10">
        <div
          className="h-3 w-16 bg-[#2d3a50] rounded animate-pulse"
          style={{ animationDelay: `${groupIndex * 200}ms` }}
        />
      </div>
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} delay={groupIndex * 200 + i * 100} />
      ))}
    </div>
  );
}

export function SeriesList({
  groupedSeries,
  chartSeries,
  totalCount,
  focusedId,
  onFocus,
  onToggleChart,
  isLoading,
}: SeriesListProps) {
  return (
    <div className="rounded-xl border border-[#2d3a50] bg-[#1a2234] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#2d3a50] px-4 py-3">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-400/20">
          <svg
            className={cn(
              "h-3.5 w-3.5 text-purple-400",
              isLoading && "animate-pulse"
            )}
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
        <span className="ml-auto text-xs text-[#64748b]">
          {isLoading ? (
            <span className="inline-block h-3 w-4 bg-[#2d3a50] rounded animate-pulse" />
          ) : (
            totalCount
          )}
        </span>
      </div>
      <div className="max-h-[350px] overflow-y-auto">
        {isLoading ? (
          <>
            {[0, 1, 2].map((i) => (
              <SkeletonGroup key={i} groupIndex={i} />
            ))}
          </>
        ) : (
          Object.entries(groupedSeries).map(([source, items]) => (
            <div key={source}>
              <div className="sticky top-0 bg-[#111827] px-4 py-1.5 z-10">
                <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                  {source}
                </span>
              </div>
              {items.map((s) => {
                const isCharted = chartSeries.has(s.id);
                const isFocused = focusedId === s.id;

                return (
                  <div
                    key={s.id}
                    onClick={() => onFocus(s.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                      "hover:bg-[#22303f]",
                      isCharted &&
                        "bg-purple-400/10 border-l-2 border-l-purple-400",
                      isFocused && "ring-1 ring-purple-400/40 ring-inset"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-sm font-mono truncate">
                          {s.id}
                        </p>
                        <button
                          type="button"
                          aria-label={
                            isCharted
                              ? `Remove ${s.id} from chart`
                              : `Add ${s.id} to chart`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleChart(s.id);
                          }}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                            isCharted
                              ? "border-purple-400/60 bg-purple-400/15 text-purple-300 hover:bg-purple-400/25"
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
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748b]">{s.name}</p>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
