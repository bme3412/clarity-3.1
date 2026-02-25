import crypto from 'crypto';

// Module-level cache: token string → numeric index (MD5 is deterministic, safe to cache indefinitely)
const tokenIndexCache = new Map();

/**
 * Financial-domain sparse vectorizer for hybrid search.
 * Uses hashed bag-of-words with BM25-style term frequency weights.
 * Optimized for earnings transcripts and financial queries.
 */
export class SparseVectorizer {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxTokens=512] - cap tokens per document
   */
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 512;
    
    // Common words that don't help retrieval
    this.stopWords = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'into',
      'over', 'about', 'their', 'they', 'been', 'were', 'after', 'before', 'are',
      'was', 'has', 'had', 'its', 'our', 'what', 'how', 'can', 'you', 'your',
      'which', 'would', 'could', 'should', 'also', 'just', 'more', 'very', 'some',
      'said', 'says', 'like', 'going', 'think', 'really', 'want', 'see', 'look',
      'things', 'thing', 'way', 'well', 'actually', 'know', 'get', 'got', 'make'
    ]);

    // High-value financial terms get boosted weight
    this.boostTerms = new Set([
      'revenue', 'profit', 'margin', 'growth', 'earnings', 'eps', 'guidance',
      'operating', 'gross', 'net', 'cash', 'flow', 'capex', 'datacenter',
      'cloud', 'segment', 'quarter', 'fiscal', 'yoy', 'qoq', 'billion', 'million',
      'increase', 'decrease', 'outlook', 'forecast', 'strategy', 'demand',
      'supply', 'backlog', 'inventory', 'customer', 'enterprise', 'consumer',
      'infrastructure', 'accelerator', 'gpu', 'cpu', 'chip', 'semiconductor'
    ]);
  }

  tokenize(text) {
    if (!text) return [];

    // Keep financial patterns like "Q3", "FY2024", "$50B", "10%"
    return text
      .toLowerCase()
      .replace(/\$(\d+)/g, 'dollar$1')  // Preserve dollar amounts
      .replace(/(\d+)%/g, '$1percent')   // Preserve percentages
      .split(/[^a-z0-9%]+/g)
      .filter(Boolean)
      .filter(token => token.length > 1 && !this.stopWords.has(token))
      .slice(0, this.maxTokens);
  }

  tokenToIndex(token) {
    if (tokenIndexCache.has(token)) return tokenIndexCache.get(token);
    const hash = crypto.createHash('md5').update(token).digest();
    const idx = hash.readUInt32BE(0);
    tokenIndexCache.set(token, idx);
    return idx;
  }

  toSparseValues(text) {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return null;

    const counts = new Map();
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    const indices = [];
    const values = [];
    for (const [token, count] of counts) {
      indices.push(this.tokenToIndex(token));
      // BM25-style TF with boost for financial terms
      let weight = 1 + Math.log(count);
      if (this.boostTerms.has(token)) {
        weight *= 1.5; // 50% boost for important financial terms
      }
      values.push(weight);
    }

    return { indices, values };
  }
}


