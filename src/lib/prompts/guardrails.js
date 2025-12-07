// Lightweight output guardrails for streaming responses.
// Focuses on banned phrases and soft length limits so we can enforce
// during streaming without blocking the UI.

const OUTPUT_GUARDRAILS = {
  maxResponseLength: 500 * 4, // ~500 tokens, rough char-based limit
  prohibitedPhrases: [
    'based on the provided context',
    "i don't have access to",
    'as an ai language model',
    'i cannot provide financial advice'
  ]
};

export function sanitizeText(text = '') {
  let sanitized = text;
  const violations = [];

  for (const phrase of OUTPUT_GUARDRAILS.prohibitedPhrases) {
    if (sanitized.toLowerCase().includes(phrase)) {
      violations.push(`prohibited phrase: ${phrase}`);
      const regex = new RegExp(phrase, 'ig');
      sanitized = sanitized.replace(regex, '');
    }
  }

  if (sanitized.length > OUTPUT_GUARDRAILS.maxResponseLength) {
    violations.push('truncated for length');
    sanitized = sanitized.slice(0, OUTPUT_GUARDRAILS.maxResponseLength);
  }

  return { sanitized, violations };
}

export function summarizeViolations(violations = []) {
  if (!violations.length) return null;
  return `Guardrails applied: ${violations.join('; ')}`;
}
