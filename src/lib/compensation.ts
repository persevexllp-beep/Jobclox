const undisclosedCompensationPattern = /^(?:n\/?a|none|nil|-+)|not\s+(?:disclosed|available|specified|provided)|undisclosed|discussable|negotiable|on\s+request|tbd|to\s+be\s+shared|as\s+per\s+(?:company\s+)?norms|competitive(?:\s+salary)?$/i;

export function hasDisclosedCompensation(value: string | null | undefined): value is string {
  const normalized = value?.trim() || '';
  if (!normalized || undisclosedCompensationPattern.test(normalized)) return false;

  const hasCurrencyOrUnit = /[$€£₹]|usd|inr|rs\.?|lpa|k\b|lakh|lac|crore|ctc|per\s+(?:hour|hr|month|year)|hourly|monthly|annually|\/\s*(?:hr|mo|yr)/i.test(normalized);
  const numericOnly = /^[\d\s,.-]+$/.test(normalized);
  return !numericOnly || hasCurrencyOrUnit;
}
