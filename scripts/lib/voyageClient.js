// Simple Voyage AI client for embedding scripts
// This is a standalone JS version that doesn't require TypeScript compilation

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const VOYAGE_EMBED_URL = 'https://api.voyageai.com/v1/embeddings';

if (!VOYAGE_API_KEY) {
  console.error('[voyageClient] VOYAGE_API_KEY is not set');
}

async function requestEmbeddings(texts, options = {}) {
  const { 
    model = 'voyage-3.5', 
    inputType = 'document', 
    outputDimension, 
    outputDtype 
  } = options;

  if (!VOYAGE_API_KEY) {
    throw new Error('VOYAGE_API_KEY is required to generate embeddings.');
  }

  const payload = {
    input: texts,
    model,
    input_type: inputType,
  };

  if (outputDimension) {
    payload.output_dimension = outputDimension;
  }

  if (outputDtype) {
    payload.output_dtype = outputDtype;
  }

  const response = await fetch(VOYAGE_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage embedding failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return (data.data || []).map((item) => item.embedding);
}

export async function embedText(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    return [];
  }

  const embeddings = await requestEmbeddings([trimmedText], options);
  return embeddings[0] || [];
}

export async function embedTexts(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const validTexts = texts
    .filter(t => typeof t === 'string')
    .map(t => t.trim())
    .filter(t => t.length > 0);

  if (validTexts.length === 0) {
    return [];
  }

  return requestEmbeddings(validTexts, options);
}

// Also export requestEmbeddings for scripts that need it directly
export { requestEmbeddings };

