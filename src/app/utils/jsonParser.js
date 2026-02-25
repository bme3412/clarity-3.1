// src/app/utils/jsonParser.js

/**
 * Robustly parses JSON from a string that might contain markdown,
 * explanatory text, or be incomplete.
 * 
 * @param {string} text - The raw text containing JSON
 * @returns {any} - The parsed JSON object or null if parsing fails
 */
export function extractAndParseJSON(text) {
  if (!text) return null;

  // 1. Try direct parse
  try {
    return JSON.parse(text);
  } catch (e) {
    // Continue to extraction methods
  }

  let jsonString = text;

  // 2. Remove markdown code blocks (```json ... ``` or just ``` ... ```)
  // This regex matches ```[optional lang]\n(content)\n```
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(codeBlockRegex);
  if (match) {
    jsonString = match[1];
  } else {
    // 3. If no code blocks, look for the first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = text.substring(firstBrace, lastBrace + 1);
    }
  }

  // 4. Try parsing the extracted string
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // 5. Aggressive cleanup: sometimes models add "Here is the JSON:" prefix inside the block
    // or trailing commas.
    // For now, let's just log and return null, as aggressive regex repair is risky.
    console.error('JSON parsing failed even after extraction:', e.message);
    return null;
  }
}

