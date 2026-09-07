// Shared between the server-only dashboard data layer and the client-side
// range picker — kept free of "server-only" so it can be imported from both.

export const SALES_RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "Last 12 months" },
] as const;

export type SalesRangePreset = (typeof SALES_RANGE_PRESETS)[number]["value"] | "custom";
