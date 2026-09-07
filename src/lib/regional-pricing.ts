/**
 * Regional material cost index — the same idea RSMeans/Craftsman-style
 * estimating references use: a multiplier on a national-average price to
 * account for a given area running higher or lower (NYC/SF/Honolulu cost
 * noticeably more than rural Mississippi for the same material). This is an
 * approximate index, not live per-supplier pricing — there's no public API
 * that returns "today's Lowe's price in this zip code." It only ever
 * adjusts a price the voice-quote AI had to *estimate* because the
 * contractor didn't say one out loud; a price the contractor actually
 * spoke is left exactly as spoken, and every number stays editable in the
 * estimate builder either way.
 */

// State-level index, national average = 1.00. Approximate — directionally
// consistent with published regional construction cost indexes.
const STATE_COST_INDEX: Record<string, number> = {
  AL: 0.85, AK: 1.28, AZ: 0.94, AR: 0.83, CA: 1.14, CO: 0.99, CT: 1.11,
  DE: 1.00, FL: 0.93, GA: 0.89, HI: 1.26, ID: 0.89, IL: 1.04, IN: 0.9,
  IA: 0.91, KS: 0.88, KY: 0.86, LA: 0.86, ME: 0.98, MD: 1.05, MA: 1.13,
  MI: 0.94, MN: 0.98, MS: 0.81, MO: 0.9, MT: 0.94, NE: 0.89, NV: 1.0,
  NH: 1.0, NJ: 1.15, NM: 0.89, NY: 1.16, NC: 0.88, ND: 0.95, OH: 0.93,
  OK: 0.84, OR: 1.03, PA: 0.99, RI: 1.05, SC: 0.86, SD: 0.88, TN: 0.87,
  TX: 0.93, UT: 0.91, VT: 1.0, VA: 0.93, WA: 1.07, WV: 0.89, WI: 0.96,
  WY: 0.93, DC: 1.09,
};

// Major-metro zip3 overrides — these run well above their state average.
const METRO_ZIP3_OVERRIDES: { prefixes: string[]; multiplier: number; label: string }[] = [
  { prefixes: ["100", "101", "102"], multiplier: 1.38, label: "Manhattan, NY" },
  { prefixes: ["940", "941"], multiplier: 1.36, label: "San Francisco, CA" },
  { prefixes: ["900", "901", "902"], multiplier: 1.2, label: "Los Angeles, CA" },
  { prefixes: ["021", "022"], multiplier: 1.22, label: "Boston, MA" },
  { prefixes: ["980", "981"], multiplier: 1.16, label: "Seattle, WA" },
  { prefixes: ["606"], multiplier: 1.12, label: "Chicago, IL" },
  { prefixes: ["200", "202", "203", "204", "205"], multiplier: 1.15, label: "Washington, DC" },
];

export type RegionalCostMultiplier = { multiplier: number; label: string };

export function getRegionalCostMultiplier(location: {
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}): RegionalCostMultiplier {
  const zip3 = location.postalCode?.trim().slice(0, 3);
  if (zip3) {
    const metro = METRO_ZIP3_OVERRIDES.find((m) => m.prefixes.includes(zip3));
    if (metro) return { multiplier: metro.multiplier, label: metro.label };
  }

  const state = location.state?.trim().toUpperCase();
  const stateIndex = state ? STATE_COST_INDEX[state] : undefined;
  if (stateIndex) {
    return { multiplier: stateIndex, label: location.city ? `${location.city}, ${state}` : state! };
  }

  return { multiplier: 1.0, label: "national average" };
}
