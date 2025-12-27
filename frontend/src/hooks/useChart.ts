"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import * as echarts from "echarts";
import type { DataResponse } from "@/types";
import { formatValue, formatSmallValue } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CHART_COLORS = [
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

interface UseChartOptions {
  getUnits: (name: string) => string;
}

export function useChart({ getUnits }: UseChartOptions) {
  const [chartIndicators, setChartIndicators] = useState<Set<string>>(
    new Set()
  );
  const [chartSeries, setChartSeries] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(1825);
  const [isLoading, setIsLoading] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

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

  const toggleIndicator = useCallback((id: string) => {
    setChartIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSeries = useCallback((id: string) => {
    setChartSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearChart = useCallback(() => {
    setChartIndicators(new Set());
    setChartSeries(new Set());
  }, []);

  const loadChartData = useCallback(async () => {
    if (chartIndicators.size === 0 && chartSeries.size === 0) {
      chartInstance.current?.clear();
      return;
    }

    setIsLoading(true);

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

    // Build a shared date index across all fetched series
    const allDatesSet = new Set<string>();
    for (const r of results) {
      if (!r?.data?.items) continue;
      for (const it of r.data.items) allDatesSet.add(it.date);
    }
    const allDates = [...allDatesSet].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );

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

      // Create map for fast lookup
      const valueByDate = new Map<string, number>();
      for (const it of data.items) valueByDate.set(it.date, it.value);

      // Forward-fill logic
      const filledData: (number | null)[] = [];
      let lastVal: number | null = null;

      for (const d of allDates) {
        const val = valueByDate.get(d);
        if (val !== undefined && val !== null) {
          lastVal = val;
          filledData.push(val);
        } else {
          // If missing, use last known value (forward fill)
          // Only forward fill if we have a previous value (don't backfill start)
          filledData.push(lastVal);
        }
      }

      legendData.push(id);
      echartsSeries.push({
        name: id,
        type: "line",
        smooth: true,
        symbol: "none",
        // Connect nulls is less critical with forward-fill, but good as backup
        connectNulls: true,
        yAxisIndex: isLarge ? 0 : 1,
        lineStyle: { width: 2 },
        itemStyle: { color: CHART_COLORS[colorIdx % CHART_COLORS.length] },
        // Map date to [date, value]
        data: allDates.map((d, i) => [d, filledData[i]]),
      });
      colorIdx++;
    }

    if (echartsSeries.length === 0) {
      return;
    }

    const option: echarts.EChartsOption = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          snap: true,
        },
        backgroundColor: "#1a2234",
        borderColor: "#2d3a50",
        textStyle: { color: "#e2e8f0", fontFamily: "Outfit" },
        formatter: function (params: unknown) {
          const p = params as Array<{
            axisValueLabel: string;
            color: string;
            seriesName: string;
            value: [string, number | null];
          }>;
          if (!p || p.length === 0) return "";
          let html = `<div style="font-weight:600;margin-bottom:8px">${p[0].axisValueLabel}</div>`;
          for (const item of p) {
            const rawVal = item.value[1];

            // Only show item if it has a value (even if 0), skip null/undefined
            // Since we forward-fill, null only happens at the very start of a series
            if (rawVal === null || rawVal === undefined) continue;

            const units = getUnits(item.seriesName);
            const largeScale = units === "USD";
            const valStr = largeScale
              ? formatValue(rawVal)
              : formatSmallValue(rawVal, units);

            html += `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
              <span style="width:10px;height:10px;border-radius:50%;background:${item.color}"></span>
              <span style="flex:1">${item.seriesName}</span>
              <span style="font-family:JetBrains Mono;font-weight:600">${valStr}</span>
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
  }, [chartIndicators, chartSeries, days, getUnits]);

  // Debounced chart reload
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => loadChartData(), 300);
  }, [chartIndicators, chartSeries, loadChartData]);

  return {
    chartRef,
    chartIndicators,
    chartSeries,
    days,
    setDays,
    isLoading,
    toggleIndicator,
    toggleSeries,
    clearChart,
  };
}
