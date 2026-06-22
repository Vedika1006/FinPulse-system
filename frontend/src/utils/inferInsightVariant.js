/**
 * Maps free-text insight lines to UI variants (green / amber / red / neutral).
 * Heuristic only — keeps the API contract as string[].
 */
export function inferInsightVariant(text) {
  const raw = (text || "").trim();
  const t = raw.toLowerCase();

  if (/^\[gemini\]/.test(t)) {
    if (/could not|failed|not loaded/i.test(t)) return "danger";
    return "neutral";
  }

  if (
    /\b(exceeding|exceeded|overspend|over your budget|over budget)\b/i.test(t) ||
    (/\bvery low\b/i.test(t) && /\bsavings\b/i.test(t))
  ) {
    return "danger";
  }

  if (
    /\b(great job|managing your budget well|strong savings|excellent)\b/i.test(t) ||
    /\bmaintain(ing)?\s+a\s+strong/i.test(t)
  ) {
    return "positive";
  }

  if (
    /\b(moderately|consider optimizing|try saving|aim for|watch closely)\b/i.test(t) ||
    /\byou spend the most\b/i.test(t)
  ) {
    return "warning";
  }

  return "neutral";
}
