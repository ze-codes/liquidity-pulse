"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Indicator, Series } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useRegistry() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadRegistry() {
      try {
        setIsLoading(true);
        const [indRes, serRes] = await Promise.all([
          fetch(`${API_URL}/live/indicators`),
          fetch(`${API_URL}/live/series-list`),
        ]);
        if (!indRes.ok) throw new Error("Failed to load indicators");
        if (!serRes.ok) throw new Error("Failed to load series");
        setIndicators(await indRes.json());
        setSeriesList(await serRes.json());
        setError(null);
      } catch (e) {
        setError(`Failed to load registry: ${e}`);
      } finally {
        setIsLoading(false);
      }
    }
    loadRegistry();
  }, []);

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

  // Group series by source for organized display
  const groupedSeries = useMemo(() => {
    return seriesList.reduce((acc, s) => {
      if (!acc[s.source]) acc[s.source] = [];
      acc[s.source].push(s);
      return acc;
    }, {} as Record<string, Series[]>);
  }, [seriesList]);

  return {
    indicators,
    seriesList,
    groupedSeries,
    getUnits,
    error,
    isLoading,
    setError,
  };
}
