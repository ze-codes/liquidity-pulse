const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Indicator {
  id: string;
  name: string;
  cadence: string;
  trigger: string;
  notes: string;
  series: string[];
  units: string;
}

export interface Series {
  id: string;
  name: string;
  source: string;
  cadence: string;
  units: string;
  notes: string;
}

export interface DataPoint {
  date: string;
  value: number;
}

export interface IndicatorData {
  id: string;
  name: string;
  units: string;
  items: DataPoint[];
}

export interface SeriesData {
  id: string;
  name: string;
  units: string;
  items: DataPoint[];
}

// Fetch list of available indicators
export async function fetchIndicators(): Promise<Indicator[]> {
  const res = await fetch(`${API_URL}/live/indicators`);
  if (!res.ok) throw new Error("Failed to fetch indicators");
  return res.json();
}

// Fetch list of available series
export async function fetchSeries(): Promise<Series[]> {
  const res = await fetch(`${API_URL}/live/series`);
  if (!res.ok) throw new Error("Failed to fetch series");
  return res.json();
}

// Fetch indicator data
export async function fetchIndicatorData(
  id: string,
  days: number = 90
): Promise<IndicatorData> {
  const res = await fetch(`${API_URL}/live/indicators/${id}?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch indicator: ${id}`);
  return res.json();
}

// Fetch series data
export async function fetchSeriesData(
  id: string,
  days: number = 90
): Promise<SeriesData> {
  const res = await fetch(`${API_URL}/live/series/${id}?days=${days}`);
  if (!res.ok) throw new Error(`Failed to fetch series: ${id}`);
  return res.json();
}
