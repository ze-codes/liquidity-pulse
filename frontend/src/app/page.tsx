"use client";

import { useState, useMemo } from "react";
import {
  Header,
  IndicatorList,
  SeriesList,
  DetailsPanel,
  Chart,
  Footer,
  ChatWidget,
} from "@/components";
import { useRegistry } from "@/hooks/useRegistry";
import { useChart } from "@/hooks/useChart";
import type { Selection, SelectionMode, Indicator, Series } from "@/types";

export default function Home() {
  // Load registry data (indicators and series)
  const {
    indicators,
    seriesList,
    groupedSeries,
    getUnits,
    error,
    setError,
    isLoading: registryLoading,
  } = useRegistry();

  // Chart state and controls
  const {
    chartRef,
    chartIndicators,
    chartSeries,
    days,
    setDays,
    isLoading,
    toggleIndicator,
    toggleSeries,
    clearChart,
  } = useChart({ getUnits });

  // Focus for relationship explorer (shows relationships in Details panel)
  const [selection, setSelection] = useState<Selection>({
    mode: null,
    id: null,
  });

  // Get selected item details for the detail panel
  const selectedItem = useMemo((): Indicator | Series | null => {
    if (!selection.id) return null;
    if (selection.mode === "indicator") {
      return indicators.find((i) => i.id === selection.id) || null;
    }
    return seriesList.find((s) => s.id === selection.id) || null;
  }, [selection, indicators, seriesList]);

  // Focus handlers (Details only; does NOT affect chart)
  const handleFocusIndicator = (id: string) => {
    if (selection.mode === "indicator" && selection.id === id) {
      setSelection({ mode: null, id: null });
      return;
    }
    setSelection({ mode: "indicator", id });
  };

  const handleFocusSeries = (id: string) => {
    if (selection.mode === "series" && selection.id === id) {
      setSelection({ mode: null, id: null });
      return;
    }
    setSelection({ mode: "series", id });
  };

  // Chart toggles (Chart only; does NOT affect Details)
  const handleToggleChartIndicator = (id: string) => {
    toggleIndicator(id);
  };

  const handleToggleChartSeries = (id: string) => {
    toggleSeries(id);
  };

  // For navigating in details panel (just show relationships, don't toggle chart)
  const handleNavigate = (mode: SelectionMode, id: string | null) => {
    setSelection({ mode, id });
  };

  const focusedIsCharted = useMemo(() => {
    if (!selection.id || !selection.mode) return false;
    if (selection.mode === "indicator")
      return chartIndicators.has(selection.id);
    return chartSeries.has(selection.id);
  }, [selection, chartIndicators, chartSeries]);

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-[#e2e8f0]">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.05)_0%,transparent_50%)]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto p-8">
        <Header />

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Relationship Explorer */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#e2e8f0]">
              Relationship Explorer
            </h2>
            <p className="text-sm text-[#64748b]">
              Click an indicator or data series to see its relationships
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* Indicators Panel */}
            <div>
              <IndicatorList
                indicators={indicators}
                chartIndicators={chartIndicators}
                focusedId={selection.mode === "indicator" ? selection.id : null}
                onFocus={handleFocusIndicator}
                onToggleChart={handleToggleChartIndicator}
                isLoading={registryLoading}
              />
            </div>

            {/* Data Series Panel */}
            <div>
              <SeriesList
                groupedSeries={groupedSeries}
                chartSeries={chartSeries}
                totalCount={seriesList.length}
                focusedId={selection.mode === "series" ? selection.id : null}
                onFocus={handleFocusSeries}
                onToggleChart={handleToggleChartSeries}
                isLoading={registryLoading}
              />
            </div>

            {/* Details Panel */}
            <div>
              <DetailsPanel
                selection={selection}
                selectedItem={selectedItem}
                isCharted={focusedIsCharted}
                indicators={indicators}
                seriesList={seriesList}
                onNavigate={handleNavigate}
              />
            </div>
          </div>
        </section>

        {/* Chart Section */}
        <Chart
          chartRef={chartRef}
          chartIndicators={chartIndicators}
          chartSeries={chartSeries}
          days={days}
          setDays={setDays}
          isLoading={isLoading}
          onClear={clearChart}
        />

        <Footer />
      </div>

      {/* Floating Chat Widget */}
      <ChatWidget />
    </main>
  );
}
