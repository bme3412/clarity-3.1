import { Langfuse } from 'langfuse';

let instance = null;

function hasKeys() {
  return process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY;
}

export function getLangfuse() {
  if (instance || !hasKeys()) return instance;
  instance = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    flushAt: 1,
    flushInterval: 0
  });
  return instance;
}

export function createTrace({ requestId, userId, query }) {
  const lf = getLangfuse();
  if (!lf) return null;
  return lf.trace({
    id: requestId,
    name: 'rag-request',
    userId,
    input: { query }
  });
}

export async function flush() {
  const lf = getLangfuse();
  if (!lf) return;
  await lf.flushAsync();
}
