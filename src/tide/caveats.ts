// Centralized safety-honesty copy. Attached at the data boundary (gate windows
// carry `indicative`, wind results carry `caveat`) so a caveat can never be
// detached from the output it qualifies. Each appears once per context — informs,
// never nags.

export const CAVEATS = {
  streamOffset: 'Stream offsets are indicative — verify in Bloc Marine for the actual date.',
  forecast: 'Verify the latest Météo-France forecast before committing.',
  estimate: 'ESTIMATE ONLY — extrapolated, not SHOM data. Not for gate planning.',
  rounding: 'Departure/arrival rounded to the nearest 5 min; stream turn shown to the minute.',
  notAuthority:
    'A planning aid only — not a navigational authority. Cross-check Bloc Marine Atlantique 2026 and the Météo-France bulletin.',
} as const
