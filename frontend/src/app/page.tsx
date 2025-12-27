"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as echarts from "echarts";
import { cn } from "@/lib/utils";

interface Indicator {
  id: string;
  name: string;
  category?: string;
  directionality?: string;
  units?: string;
  series?: string[];
}

interface Series {
  id: string;
  name: string;
  source: string;
  cadence: string;
  units: string;
}

interface DataItem {
  date: string;
  value: number;
}

interface DataResponse {
  id: string;
  name: string;
  items: DataItem[];
}

type SelectionMode = "indicator" | "series" | null;
type Selection = { mode: SelectionMode; id: string | null };

export default function Home() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // Selection for relationship explorer (hover/click to show relationships)
  const [selection, setSelection] = useState<Selection>({
    mode: null,
    id: null,
  });

  // Selected items for charting
  const [chartIndicators, setChartIndicators] = useState<Set<string>>(
    new Set()
  );
  const [chartSeries, setChartSeries] = useState<Set<string>>(new Set());

  const [days, setDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Get selected item details for the detail panel
  const selectedItem = useMemo(() => {
    if (!selection.id) return null;
    if (selection.mode === "indicator") {
      return indicators.find((i) => i.id === selection.id);
    }
    return seriesList.find((s) => s.id === selection.id);
  }, [selection, indicators, seriesList]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;
    chartInstance.current = echarts.init(chartRef.current, "dark");

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  // Load registry on mount
  useEffect(() => {
    async function loadRegistry() {
      try {
        const [indRes, serRes] = await Promise.all([
          fetch(`${API_URL}/live/indicators`),
          fetch(`${API_URL}/live/series-list`),
        ]);
        if (!indRes.ok) throw new Error("Failed to load indicators");
        if (!serRes.ok) throw new Error("Failed to load series");
        setIndicators(await indRes.json());
        setSeriesList(await serRes.json());
      } catch (e) {
        setError(`Failed to load registry: ${e}`);
      }
    }
    loadRegistry();
  }, [API_URL]);

  const getUnits = useCallback(
    (name: string): string => {
      const ind = indicators.find((i) => i.id === name);
      if (ind?.units) return ind.units;
      const ser = seriesList.find((s) => s.id === name);
      if (ser?.units) return ser.units;
      return "USD";
    },
    [indicators, seriesList]
  );

  const formatValue = (value: number): string => {
    if (value == null || !isFinite(value)) return "N/A";
    const abs = Math.abs(value);
    if (abs >= 1e12) return (value / 1e12).toFixed(2) + "T";
    if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (value / 1e3).toFixed(2) + "K";
    return value.toFixed(2);
  };

  const formatSmallValue = useCallback(
    (value: number, name: string): string => {
      if (value == null || !isFinite(value)) return "N/A";
      const units = getUnits(name);
      if (units === "bps") return value.toFixed(2) + " bps";
      if (units === "percent") return value.toFixed(2) + "%";
      if (units === "index") return value.toFixed(2);
      return value.toFixed(2);
    },
    [getUnits]
  );

  // Handle selection - shows relationships AND toggles chart
  const handleSelectIndicator = (id: string) => {
    // Toggle chart
    setChartIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Update relationship view
    if (selection.mode === "indicator" && selection.id === id) {
      setSelection({ mode: null, id: null });
    } else {
      setSelection({ mode: "indicator", id });
    }
  };

  const handleSelectSeries = (id: string) => {
    // Toggle chart
    setChartSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Update relationship view
    if (selection.mode === "series" && selection.id === id) {
      setSelection({ mode: null, id: null });
    } else {
      setSelection({ mode: "series", id });
    }
  };

  // For navigating in details panel (just show relationships, don't toggle chart)
  const handleNavigate = (mode: SelectionMode, id: string | null) => {
    setSelection({ mode, id });
  };

  const loadChartData = useCallback(async () => {
    if (chartIndicators.size === 0 && chartSeries.size === 0) {
      chartInstance.current?.clear();
      return;
    }

    setIsLoading(true);
    const colors = [
      "#22d3ee",
      "#8b5cf6",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#06b6d4",
      "#84cc16",
      "#f97316",
      "#6366f1",
    ];

    const isLargeScale = (name: string) => getUnits(name) === "USD";

    // Fetch all data
    const indicatorPromises = [...chartIndicators].map(async (id) => {
      try {
        const res = await fetch(
          `${API_URL}/live/indicators/${id}?days=${days}`
        );
        if (!res.ok) return null;
        return {
          id,
          data: (await res.json()) as DataResponse,
          type: "indicator",
        };
      } catch {
        return null;
      }
    });

    const seriesPromises = [...chartSeries].map(async (id) => {
      try {
        const res = await fetch(`${API_URL}/live/series/${id}?days=${days}`);
        if (!res.ok) return null;
        return { id, data: (await res.json()) as DataResponse, type: "series" };
      } catch {
        return null;
      }
    });

    const results = await Promise.all([
      ...indicatorPromises,
      ...seriesPromises,
    ]);
    setIsLoading(false);

    const echartsSeries: echarts.SeriesOption[] = [];
    const legendData: string[] = [];
    let colorIdx = 0;
    const rightAxisUnits = new Set<string>();

    for (const result of results) {
      if (!result || !result.data.items || result.data.items.length === 0)
        continue;

      const { id, data } = result;
      const units = getUnits(id);
      const isLarge = units === "USD";

      if (!isLarge) rightAxisUnits.add(units);

      legendData.push(id);
      echartsSeries.push({
        name: id,
        type: "line",
        smooth: true,
        symbol: "none",
        yAxisIndex: isLarge ? 0 : 1,
        lineStyle: { width: 2 },
        itemStyle: { color: colors[colorIdx % colors.length] },
        data: data.items.map((i) => [i.date, i.value]),
      });
      colorIdx++;
    }

    if (echartsSeries.length === 0) {
      setError("No data available for selected items");
      return;
    }

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a2234",
        borderColor: "#2d3a50",
        textStyle: { color: "#e2e8f0", fontFamily: "Outfit" },
        formatter: function (params: unknown) {
          const p = params as Array<{
            axisValueLabel: string;
            color: string;
            seriesName: string;
            value: [string, number];
          }>;
          let html = `<div style="font-weight:600;margin-bottom:8px">${p[0].axisValueLabel}</div>`;
          for (const item of p) {
            const largeScale = isLargeScale(item.seriesName);
            const val = largeScale
              ? formatValue(item.value[1])
              : formatSmallValue(item.value[1], item.seriesName);
            html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
              <span style="width:10px;height:10px;border-radius:50%;background:${item.color}"></span>
              <span style="flex:1">${item.seriesName}</span>
              <span style="font-family:JetBrains Mono;font-weight:600">${val}</span>
            </div>`;
          }
          return html;
        },
      },
      legend: {
        data: legendData,
        bottom: 10,
        textStyle: { color: "#94a3b8", fontFamily: "Outfit" },
      },
      grid: { left: 80, right: 80, top: 40, bottom: 50 },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#2d3a50" } },
        axisTick: { lineStyle: { color: "#2d3a50" } },
        axisLabel: { color: "#94a3b8", fontFamily: "Outfit" },
        splitLine: { lineStyle: { color: "#2d3a50", opacity: 0.5 } },
      },
      yAxis: [
        {
          type: "value",
          name: "USD",
          nameTextStyle: { color: "#64748b", fontFamily: "Outfit" },
          axisLine: { lineStyle: { color: "#22d3ee" } },
          axisTick: { lineStyle: { color: "#22d3ee" } },
          axisLabel: {
            color: "#22d3ee",
            fontFamily: "JetBrains Mono",
            formatter: (v: number) => formatValue(v),
          },
          splitLine: { lineStyle: { color: "#2d3a50", opacity: 0.3 } },
          scale: true,
        },
        {
          type: "value",
          name: rightAxisUnits.has("percent")
            ? "%"
            : rightAxisUnits.has("bps")
            ? "bps"
            : "idx",
          nameTextStyle: { color: "#64748b", fontFamily: "Outfit" },
          axisLine: { lineStyle: { color: "#8b5cf6" } },
          axisTick: { lineStyle: { color: "#8b5cf6" } },
          axisLabel: {
            color: "#8b5cf6",
            fontFamily: "JetBrains Mono",
            formatter: (v: number) => {
              if (rightAxisUnits.has("percent")) return v.toFixed(2) + "%";
              if (rightAxisUnits.has("bps")) return v.toFixed(2) + " bps";
              return v.toFixed(2);
            },
          },
          splitLine: { lineStyle: { color: "#2d3a50", opacity: 0.3 } },
          scale: true,
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          filterMode: "none",
          start: 0,
          end: 100,
        },
      ],
      series: echartsSeries,
    };

    chartInstance.current?.setOption(option, { notMerge: true });
  }, [chartIndicators, chartSeries, days, API_URL, getUnits, formatSmallValue]);

  // Debounced chart reload
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => loadChartData(), 300);
  }, [chartIndicators, chartSeries, loadChartData]);

  // Group series by source
  const groupedSeries = useMemo(() => {
    return seriesList.reduce((acc, s) => {
      if (!acc[s.source]) acc[s.source] = [];
      acc[s.source].push(s);
      return acc;
    }, {} as Record<string, Series[]>);
  }, [seriesList]);

  return (
    <main className="min-h-screen bg-[#0a0f1a] text-[#e2e8f0]">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.05)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.05)_0%,transparent_50%)]" />
      </div>

      <div className="relative max-w-[1600px] mx-auto p-8">
        {/* Header */}
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

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500 text-red-500 rounded-lg">
            {error}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Indicators Panel */}
            <div className="lg:col-span-4">
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
                        onClick={() => handleSelectIndicator(ind.id)}
                        className={cn(
                          "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                          "hover:bg-[#22303f]",
                          isCharted &&
                            "bg-cyan-400/10 border-l-2 border-l-cyan-400"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {ind.name || ind.id}
                              </p>
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
            </div>

            {/* Data Series Panel */}
            <div className="lg:col-span-4">
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
                  <span className="ml-auto text-xs text-[#64748b]">
                    {seriesList.length}
                  </span>
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
                            onClick={() => handleSelectSeries(s.id)}
                            className={cn(
                              "w-full px-4 py-3 text-left transition-all cursor-pointer border-b border-[#2d3a50] last:border-0",
                              "hover:bg-[#22303f]",
                              isCharted &&
                                "bg-purple-400/10 border-l-2 border-l-purple-400"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm font-mono">
                                {s.id}
                              </p>
                              {isCharted && (
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-[#64748b]">
                              {s.name}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Details Panel */}
            <div className="lg:col-span-4">
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
                  <h3 className="font-medium">
                    {selectedItem
                      ? selection.mode === "indicator"
                        ? (selectedItem as Indicator).name
                        : (selectedItem as Series).id
                      : "Details"}
                  </h3>
                </div>

                {!selectedItem ? (
                  <div className="flex min-h-[300px] items-center justify-center px-4 py-8">
                    <p className="text-center text-sm text-[#64748b]">
                      Select an indicator or data series to view its
                      relationships
                    </p>
                  </div>
                ) : selection.mode === "indicator" ? (
                  <div className="p-4">
                    <p className="text-sm text-[#94a3b8] mb-1 font-mono">
                      {(selectedItem as Indicator).id}
                    </p>
                    <p className="text-xs text-[#64748b] mb-4">
                      {(selectedItem as Indicator).directionality?.replace(
                        /_/g,
                        " "
                      )}
                    </p>

                    <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#64748b]">
                      Uses Data Series
                    </h4>
                    <div className="space-y-2">
                      {((selectedItem as Indicator).series || []).map(
                        (seriesId) => {
                          const s = seriesList.find((x) => x.id === seriesId);
                          return (
                            <div
                              key={seriesId}
                              className="flex items-center gap-3 rounded-lg bg-[#111827] px-3 py-2 cursor-pointer hover:bg-[#1a2234]"
                              onClick={() => handleNavigate("series", seriesId)}
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
                                <p className="text-sm font-medium font-mono">
                                  {seriesId}
                                </p>
                                <p className="text-xs text-[#64748b]">
                                  {s?.name || seriesId}
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
                          );
                        }
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-sm text-[#94a3b8] mb-1">
                      {(selectedItem as Series).name}
                    </p>
                    <p className="text-xs text-[#64748b] mb-4">
                      {(selectedItem as Series).source} •{" "}
                      {(selectedItem as Series).cadence} •{" "}
                      {(selectedItem as Series).units}
                    </p>

                    <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#64748b]">
                      Used By Indicators
                    </h4>
                    <div className="space-y-2">
                      {indicators
                        .filter((i) =>
                          i.series?.includes((selectedItem as Series).id)
                        )
                        .map((ind) => (
                          <div
                            key={ind.id}
                            className="flex items-center gap-3 rounded-lg bg-[#111827] px-3 py-2 cursor-pointer hover:bg-[#1a2234]"
                            onClick={() => handleNavigate("indicator", ind.id)}
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
                              <p className="text-sm font-medium">
                                {ind.name || ind.id}
                              </p>
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
                      {indicators.filter((i) =>
                        i.series?.includes((selectedItem as Series).id)
                      ).length === 0 && (
                        <p className="text-sm text-[#64748b]">
                          No indicators use this data series
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Chart Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[#e2e8f0]">Chart</h2>
              <p className="text-sm text-[#64748b]">
                {chartIndicators.size + chartSeries.size > 0
                  ? `${chartIndicators.size} indicators, ${chartSeries.size} series selected`
                  : "Add items from the explorer above to chart them"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-[#64748b] font-medium">
                  Days:
                </label>
                <input
                  type="number"
                  value={days}
                  onChange={(e) => setDays(parseInt(e.target.value) || 90)}
                  min={7}
                  max={365}
                  className="w-20 px-3 py-1.5 bg-[#1a2234] border border-[#2d3a50] rounded-lg font-mono text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 outline-none"
                />
              </div>
              {(chartIndicators.size > 0 || chartSeries.size > 0) && (
                <button
                  onClick={() => {
                    setChartIndicators(new Set());
                    setChartSeries(new Set());
                  }}
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
            {chartIndicators.size === 0 && chartSeries.size === 0 && (
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

        {/* Footer */}
        <footer className="text-center py-8 mt-8 border-t border-[#2d3a50] text-sm text-[#64748b]">
          Data from{" "}
          <a
            href="https://fred.stlouisfed.org"
            target="_blank"
            className="text-cyan-400 hover:underline"
          >
            FRED
          </a>
          ,{" "}
          <a
            href="https://fiscaldata.treasury.gov"
            target="_blank"
            className="text-cyan-400 hover:underline"
          >
            Treasury
          </a>
          , and{" "}
          <a
            href="https://www.financialresearch.gov"
            target="_blank"
            className="text-cyan-400 hover:underline"
          >
            OFR
          </a>
        </footer>
      </div>
    </main>
  );
}
