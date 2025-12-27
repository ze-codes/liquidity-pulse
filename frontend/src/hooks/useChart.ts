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
  const [days, setDays] = useState(90);
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
        itemStyle: { color: CHART_COLORS[colorIdx % CHART_COLORS.length] },
        data: data.items.map((i) => [i.date, i.value]),
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
            const units = getUnits(item.seriesName);
            const largeScale = units === "USD";
            const val = largeScale
              ? formatValue(item.value[1])
              : formatSmallValue(item.value[1], units);
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
