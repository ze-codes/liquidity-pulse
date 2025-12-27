"use client";

import { cn } from "@/lib/utils";
import type { Indicator, Series, Selection, SelectionMode } from "@/types";

interface DetailsPanelProps {
  selection: Selection;
  selectedItem: Indicator | Series | null;
  isCharted: boolean;
  indicators: Indicator[];
  seriesList: Series[];
  onNavigate: (mode: SelectionMode, id: string | null) => void;
}

export function DetailsPanel({
  selection,
  selectedItem,
  isCharted,
  indicators,
  seriesList,
  onNavigate,
}: DetailsPanelProps) {
  return (
    <div className="rounded-xl border border-[#2d3a50] bg-[#1a2234] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#2d3a50] px-4 py-3">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            selection.mode === "indicator"
              ? "bg-cyan-400/20"
              : selection.mode === "series"
              ? "bg-purple-400/20"
              : "bg-[#2d3a50]"
          )}
        >
          <svg
            className={cn(
              "h-3.5 w-3.5",
              selection.mode === "indicator"
                ? "text-cyan-400"
                : selection.mode === "series"
                ? "text-purple-400"
                : "text-[#64748b]"
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="font-medium min-w-0 truncate">
          {selectedItem
            ? selection.mode === "indicator"
              ? (selectedItem as Indicator).name
              : (selectedItem as Series).id
            : "Details"}
        </h3>
        {selectedItem && (
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full border px-2 py-0.5 text-xs",
              isCharted
                ? selection.mode === "indicator"
                  ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                  : "border-purple-400/40 bg-purple-400/10 text-purple-300"
                : "border-[#2d3a50] bg-[#111827] text-[#64748b]"
            )}
            title={
              isCharted
                ? "This item is currently displayed on the chart"
                : "This item is not currently displayed on the chart"
            }
          >
            {isCharted ? "On chart" : "Not on chart"}
          </span>
        )}
      </div>

      <div className="max-h-[350px] overflow-y-auto">
        {!selectedItem ? (
          <div className="flex min-h-[300px] items-center justify-center px-4 py-8">
            <p className="text-center text-sm text-[#64748b]">
              Select an indicator or data series to view its relationships
            </p>
          </div>
        ) : selection.mode === "indicator" ? (
          <IndicatorDetails
            indicator={selectedItem as Indicator}
            seriesList={seriesList}
            onNavigate={onNavigate}
          />
        ) : (
          <SeriesDetails
            series={selectedItem as Series}
            indicators={indicators}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

function IndicatorDetails({
  indicator,
  seriesList,
  onNavigate,
}: {
  indicator: Indicator;
  seriesList: Series[];
  onNavigate: (mode: SelectionMode, id: string | null) => void;
}) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <p className="text-sm text-[#94a3b8] mb-1 font-mono">{indicator.id}</p>
        <p className="text-xs text-[#64748b]">
          {indicator.directionality?.replace(/_/g, " ")}
        </p>
      </div>

      {/* Rich Metadata */}
      <div className="mb-6 space-y-4">
        {indicator.description && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Description
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {indicator.description}
            </p>
          </div>
        )}
        {indicator.impact && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Impact
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {indicator.impact}
            </p>
          </div>
        )}
        {indicator.interpretation && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Interpretation
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {indicator.interpretation}
            </p>
          </div>
        )}
      </div>

      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#64748b]">
        Uses Data Series
      </h4>
      <div className="space-y-2">
        {(indicator.series || []).map((seriesId) => {
          const s = seriesList.find((x) => x.id === seriesId);
          return (
            <div
              key={seriesId}
              className="flex items-center gap-3 rounded-lg bg-[#111827] px-3 py-2 cursor-pointer hover:bg-[#1a2234]"
              onClick={() => onNavigate("series", seriesId)}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded bg-purple-400/20">
                <svg
                  className="h-3 w-3 text-purple-400"
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
              <div className="flex-1">
                <p className="text-sm font-medium font-mono">{seriesId}</p>
                <p className="text-xs text-[#64748b]">{s?.name || seriesId}</p>
              </div>
              <svg
                className="h-4 w-4 text-[#64748b]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeriesDetails({
  series,
  indicators,
  onNavigate,
}: {
  series: Series;
  indicators: Indicator[];
  onNavigate: (mode: SelectionMode, id: string | null) => void;
}) {
  const usedByIndicators = indicators.filter((i) =>
    i.series?.includes(series.id)
  );

  return (
    <div className="p-4">
      <div className="mb-4">
        <p className="text-sm text-[#94a3b8] mb-1">{series.name}</p>
        <p className="text-xs text-[#64748b]">
          {series.source} • {series.cadence} • {series.units}
        </p>
      </div>

      {/* Rich Metadata */}
      <div className="mb-6 space-y-4">
        {series.description && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Description
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {series.description}
            </p>
          </div>
        )}
        {series.impact && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Impact
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {series.impact}
            </p>
          </div>
        )}
        {series.interpretation && (
          <div>
            <h4 className="text-[10px] uppercase font-bold text-[#64748b] mb-1.5">
              Interpretation
            </h4>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              {series.interpretation}
            </p>
          </div>
        )}
      </div>

      <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#64748b]">
        Used By Indicators
      </h4>
      <div className="space-y-2">
        {usedByIndicators.map((ind) => (
          <div
            key={ind.id}
            className="flex items-center gap-3 rounded-lg bg-[#111827] px-3 py-2 cursor-pointer hover:bg-[#1a2234]"
            onClick={() => onNavigate("indicator", ind.id)}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-cyan-400/20">
              <svg
                className="h-3 w-3 text-cyan-400"
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
            <div className="flex-1">
              <p className="text-sm font-medium">{ind.name || ind.id}</p>
              <p className="text-xs text-[#64748b]">
                Uses {ind.series?.length || 0} series
              </p>
            </div>
            <svg
              className="h-4 w-4 text-[#64748b]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        ))}
        {usedByIndicators.length === 0 && (
          <p className="text-sm text-[#64748b]">
            No indicators use this data series
          </p>
        )}
      </div>
    </div>
  );
}
