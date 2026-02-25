import { anthropicCompletion } from '../../app/lib/llm/anthropicClient.js';

export class RAGEvaluator {
  /**
   * Evaluates the faithfulness of the answer to the retrieved context.
   * "Is the answer derived primarily from the context?"
   */
  async evaluateFaithfulness(answer, context) {
    const systemPrompt = `
    You are an evaluation system. Your task is to determining if a generated answer is faithful to the provided context.
    
    Score from 0.0 to 1.0, where:
    1.0 = The answer is completely derived from the provided context.
    0.0 = The answer contains hallucinations or information not present in the context.

    Return JSON: { "score": number, "reasoning": string }
    
    IMPORTANT: Return ONLY the raw JSON string. Do not wrap it in markdown code blocks (e.g., no \`\`\`json).
    `;

    const userPrompt = `
    Context:
    ${context}

    Answer:
    ${answer}
    `;

    return this._callLLM(systemPrompt, userPrompt);
  }

  /**
   * Evaluates the relevance of the answer to the user's question.
   * "Does the answer actually address the prompt?"
   */
  async evaluateAnswerRelevance(question, answer) {
    const systemPrompt = `
    You are an evaluation system. Your task is to determine if a generated answer is relevant to the user's question.

    Score from 0.0 to 1.0, where:
    1.0 = The answer directly and completely addresses the question.
    0.0 = The answer is irrelevant or non-responsive.

    Return JSON: { "score": number, "reasoning": string }

    IMPORTANT: Return ONLY the raw JSON string. Do not wrap it in markdown code blocks (e.g., no \`\`\`json).
    `;

    const userPrompt = `
    Question: "${question}"
    Answer: "${answer}"
    `;

    return this._callLLM(systemPrompt, userPrompt);
  }

  /**
   * Evaluates the accuracy of the answer compared to a ground truth.
   * "Does the answer contain the correct facts compared to the ground truth?"
   */
  async evaluateAccuracy(answer, groundTruth) {
    const systemPrompt = `
    You are an evaluation system. Your task is to determine if a generated answer is accurate compared to a ground truth answer.

    Score from 0.0 to 1.0, where:
    1.0 = The answer contains the same key facts and numbers as the ground truth.
    0.0 = The answer is factually incorrect or contradicts the ground truth.
    
    If the answer provides *more* detail than the ground truth but is consistent, that is still 1.0.
    If the answer is vague where the ground truth is specific, penalize the score.

    Return JSON: { "score": number, "reasoning": string }

    IMPORTANT: Return ONLY the raw JSON string. Do not wrap it in markdown code blocks (e.g., no \`\`\`json).
    `;

    const userPrompt = `
    Ground Truth: "${groundTruth}"
    Generated Answer: "${answer}"
    `;

    return this._callLLM(systemPrompt, userPrompt);
  }

  async _callLLM(systemPrompt, userPrompt) {
    try {
      const result = await anthropicCompletion({
        model: 'claude-opus-4-5-20251101',
        systemPrompt,
        userPrompt,
        temperature: 0,
        maxTokens: 1024,
      });
      
      return this._robustJSONParse(result);
    } catch (e) {
      console.error("Evaluation error:", e);
      return { score: 0, reasoning: e.message };
    }
  }

  _robustJSONParse(text) {
    if (!text) return { score: 0, reasoning: "Empty response from LLM" };

    try {
      // 1. Try direct parse first
      return JSON.parse(text);
    } catch (e) {
      // 2. Cleanup markdown and surrounding text
      let cleaned = text
        .replace(/^```json\s*/i, '') // Remove start code block
        .replace(/^```\s*/i, '')      // Remove start code block (generic)
        .replace(/```\s*$/i, '')      // Remove end code block
        .trim();

      // 3. Find the outer braces to ignore "Here is the JSON:" prefixes
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      try {
        return JSON.parse(cleaned);
      } catch (innerErr) {
        console.error("JSON Parse Failed. Raw:", text);
        return { 
          score: 0, 
          reasoning: `Failed to parse JSON: ${innerErr.message}. Raw output starts with: ${text.substring(0, 50)}...` 
        };
      }
    }
  }
}


