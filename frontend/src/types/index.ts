// Shared types for the Liquidity Pulse frontend

export interface Indicator {
  id: string;
  name: string;
  category?: string;
  directionality?: string;
  units?: string;
  series?: string[];
  description?: string;
  impact?: string;
  interpretation?: string;
}

export interface Series {
  id: string;
  name: string;
  source: string;
  cadence: string;
  units: string;
  description?: string;
  impact?: string;
  interpretation?: string;
}

export interface DataItem {
  date: string;
  value: number;
}

export interface DataResponse {
  id: string;
  name: string;
  items: DataItem[];
}

export type SelectionMode = "indicator" | "series" | null;

export interface Selection {
  mode: SelectionMode;
  id: string | null;
}
