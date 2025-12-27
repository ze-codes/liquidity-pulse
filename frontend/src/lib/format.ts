// Formatting utilities for chart values

export function formatValue(value: number): string {
  if (value == null || !isFinite(value)) return "N/A";
  const abs = Math.abs(value);
  if (abs >= 1e12) return (value / 1e12).toFixed(2) + "T";
  if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (value / 1e3).toFixed(2) + "K";
  return value.toFixed(2);
}

export function formatSmallValue(value: number, units: string): string {
  if (value == null || !isFinite(value)) return "N/A";
  if (units === "bps") return value.toFixed(2) + " bps";
  if (units === "percent") return value.toFixed(2) + "%";
  if (units === "index") return value.toFixed(2);
  return value.toFixed(2);
}
