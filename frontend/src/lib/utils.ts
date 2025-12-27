import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format large USD values (e.g., 5.2T, 800B, 50M)
export function formatUSD(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1e12) {
    return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  } else if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  } else if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  } else if (abs >= 1e3) {
    return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

// Format value based on units
export function formatValue(value: number, units: string): string {
  switch (units) {
    case "USD":
      return formatUSD(value);
    case "percent":
      return `${value.toFixed(2)}%`;
    case "bps":
      return `${value.toFixed(2)} bps`;
    case "index":
      return value.toFixed(2);
    default:
      return value.toFixed(2);
  }
}
