import { executeToolCall } from './executor.js';

/**
 * Execute a tool call with Langfuse tracing (if trace provided).
 * @param {string} toolName
 * @param {object} toolInput
 * @param {object|null} trace - Langfuse trace instance
 */
export async function executeToolCallWithTracing(toolName, toolInput, trace) {
  const span = trace?.span
    ? trace.span({ name: `tool:${toolName}`, input: toolInput })
    : null;
  try {
    const result = await executeToolCall(toolName, toolInput);
    span?.end({
      output: result.success ? result.result : { error: result.error },
      metadata: {
        success: result.success,
        latencyMs: result.latencyMs
      }
    });
    return result;
  } catch (error) {
    span?.end({
      output: { error: error.message },
      metadata: { success: false }
    });
    throw error;
  }
}
