# Dense vs Hybrid Search: What We Actually Learned

*Spoiler: It's not as simple as "hybrid is better"*

---

## The Problem: Dense Search Wasn't Enough

When I first built Clarity, my financial analysis RAG system, I thought dense embeddings would handle everything. Semantic similarity should be enough, right?

**Wrong.**

My evaluation showed embarrassing failures:

```
Query: "What was AMD's Q3 2024 revenue?"
Result: Retrieved Q2 2024 data  ❌

Query: "Compare Apple and Google's AI approaches"
Result: Retrieved AMD data (only company embedded)  ❌

Query: "What did Jensen Huang say about MI300?"
Result: Missed the MI300 keyword entirely  ❌
```

### The Root Causes

1. **Keyword Blindness**: Dense embeddings capture *meaning*, not exact terms. "Q3 2024" and "Q2 2024" are semantically similar but factually different.

2. **Data Coverage Gaps**: Only AMD was fully embedded. Queries for NVDA, AAPL, GOOGL hit empty results.

3. **No Hybrid Search**: My Pinecone index used `cosine` metric, which doesn't support sparse vectors.

| Metric | Baseline Score | Target |
|--------|---------------|--------|
| Relevance | 0.77 | >0.90 |
| Faithfulness | 0.77 | >0.90 |
| **Accuracy** | **0.65** | >0.85 |
| Latency | 19,536ms | <10,000ms |

The 0.65 accuracy was unacceptable for a financial analysis tool where precision matters.

---

## The Solution: Hybrid Search with Sparse Vectors

### What is Hybrid Search?

Hybrid search combines two retrieval signals:

1. **Dense vectors** (semantic): "What does this mean?"
2. **Sparse vectors** (lexical): "Which exact words appear?"

```
Query: "AMD Q3 2024 revenue growth"

Dense Match (semantic):
  ✅ "Revenue performance in the third quarter"
  ✅ "Financial results showed strong growth"
  
Sparse Match (keyword/BM25):
  ✅ "AMD" (exact match)
  ✅ "Q3" (exact match)
  ✅ "2024" (exact match)
  ✅ "revenue" (exact match)

Hybrid Score = α × Dense + (1-α) × Sparse
```

### Why Pinecone Needed a New Index

My original index (`clarity-openai`) used:
- **Metric**: `cosine`
- **Vectors**: Dense only (1536 dimensions)

For hybrid search, I needed:
- **Metric**: `dotproduct` (required for sparse+dense blending)
- **Vectors**: Dense + Sparse

Pinecone doesn't let you change the metric on an existing index, so I created a new one.

---

## Implementation: Step by Step

### Step 1: Create a Hybrid-Ready Index

```javascript
await pinecone.createIndex({
  name: 'clarity-hybrid',
  dimension: 1536,
  metric: 'dotproduct',  // Required for hybrid
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});
```

### Step 2: Generate Sparse Vectors (BM25-style)

I created a simple sparse vectorizer using hashed bag-of-words:

```javascript
class SparseVectorizer {
  tokenize(text) {
    return text
      .toLowerCase()
      .split(/[^a-z0-9%]+/g)
      .filter(token => token.length > 2 && !STOPWORDS.has(token));
  }

  tokenToIndex(token) {
    // Hash to consistent index in sparse space
    const hash = crypto.createHash('md5').update(token).digest();
    return hash.readUInt32BE(0) % 30000;
  }

  toSparseValues(text) {
    const tokens = this.tokenize(text);
    const counts = new Map();
    
    for (const token of tokens) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }

    const indices = [];
    const values = [];
    
    for (const [token, count] of counts) {
      indices.push(this.tokenToIndex(token));
      values.push(1 + Math.log(count));  // BM25-style TF weighting
    }

    return { indices, values };
  }
}
```

### Step 3: Embed with Both Vector Types

```javascript
async function processChunk(chunk, ticker) {
  // Dense embedding from OpenAI
  const denseVector = await getDenseEmbedding(chunk);
  
  // Sparse vector for keywords
  const sparseVector = sparseVectorizer.toSparseValues(chunk);
  
  return {
    id: `${ticker}-${chunkId}`,
    values: denseVector,
    sparseValues: sparseVector,  // ← The key addition
    metadata: { ticker, text: chunk, ... }
  };
}
```

### Step 4: Query with Hybrid Blending

```javascript
async function queryHybrid(query, alpha = 0.5) {
  const denseVector = await getDenseEmbedding(query);
  const sparseVector = sparseVectorizer.toSparseValues(query);
  
  const result = await index.query({
    vector: denseVector,
    sparseVector: sparseVector,
    topK: 10,
    includeMetadata: true
  });
  
  return result.matches;
}
```

The `alpha` parameter controls the blend:
- `alpha = 1.0`: Pure dense (semantic only)
- `alpha = 0.5`: Balanced hybrid
- `alpha = 0.0`: Pure sparse (BM25 only)

---

## Evaluation: Dense vs Hybrid

I ran 10 test queries across different financial query types:

| Query Type | Example | Winner |
|------------|---------|--------|
| Exact revenue lookup | "AMD's Q3 2024 revenue" | **Hybrid** ✅ |
| Product competition | "NVIDIA on MI300 competition" | Tie |
| Multi-company comparison | "AMD vs NVIDIA data center" | **Dense** ✅ |
| Strategic analysis | "Meta's AI infrastructure approach" | Tie |
| Future guidance | "Oracle FY2026 cloud guidance" | **Dense** ✅ |
| Executive quotes | "Tim Cook on Apple Intelligence" | Tie |
| Specific metrics | "Google Cloud Q4 2024 growth" | **Hybrid** ✅ |
| Trend analysis | "Azure revenue trend" | **Dense** ✅ |
| Competitive advantages | "Broadcom AI networking" | **Dense** ✅ |
| Product announcements | "Salesforce AI products" | **Dense** ✅ |

**Overall: Dense 5 wins, Hybrid 2 wins, 3 ties**

### Key Finding: Context is Everything

The results surprised me—dense won overall. But here's the catch:

| Index | Vectors | Coverage |
|-------|---------|----------|
| clarity-openai (dense) | 28,110 | Full transcript text |
| clarity-hybrid | 4,583 | Structured data only |

The dense index has **6x more vectors**, giving it broader coverage. The hybrid index, while smaller, excels precisely where it should:

```
Query: "What was AMD's Q3 2024 revenue?"

Dense Only (clarity-openai):
  - Retrieved Q3 2025 guidance data  ❌
  - LLM Rating: 2/5
  - Wrong year entirely

Hybrid (clarity-hybrid):
  - Retrieved exact Q3 2024: "$6.8B revenue"  ✅
  - LLM Rating: 5/5
  - Correct answer with YoY breakdown
```

### Latency Comparison

| Metric | Dense | Hybrid |
|--------|-------|--------|
| Avg Query Latency | 425ms | **248ms** |
| Keyword Hit Rate | **85%** | 78% |

**Hybrid is 42% faster** despite the additional sparse vector computation. This suggests Pinecone's native hybrid scoring is well-optimized.

---

## Results: When to Use Each

The evaluation revealed that **neither approach is universally better**:

| Query Type | Best Approach | Why |
|------------|---------------|-----|
| **Exact numbers** (Q3 revenue, $6.8B) | Hybrid | Keyword matching catches exact quarters/figures |
| **Strategic questions** (AI strategy) | Dense | Semantic understanding of concepts |
| **Product names** (MI300, Blackwell) | Hybrid | Exact term matching |
| **Trend analysis** (revenue over time) | Dense | Understands temporal relationships |
| **Multi-company comparison** | Dense | Better at synthesizing across sources |
| **Guidance/forward-looking** | Dense | Catches context around projections |

### The Real Takeaway

**Don't abandon dense for hybrid—use both strategically.**

Our `auto` strategy now uses an LLM to classify queries:
- Financial metrics → Hybrid (α=0.3)
- Strategic analysis → Dense (α=1.0)
- Mixed queries → Balanced (α=0.5)

### Performance Summary

| Metric | Dense Index | Hybrid Index |
|--------|-------------|--------------|
| Vectors | 28,110 | 4,583 |
| Avg Latency | 425ms | **248ms** |
| Best for | Strategic, trends | Exact metrics |
| Index metric | cosine | dotproduct |

---

## Lessons Learned

### 1. Dense Search Has Blind Spots (But Still Wins Often)

Embeddings are great at "what does this mean?" but terrible at "which exact words appear?" For financial data where Q3 ≠ Q4 and $4.2B ≠ $4.8B, you need lexical matching.

**But**: Dense search still won 5/10 queries in our eval. Strategic questions, trend analysis, and multi-company comparisons benefit from semantic understanding.

### 2. Data Coverage Matters More Than Algorithm

Our hybrid index had only 16% of the vectors in our dense index (4,583 vs 28,110). This single factor likely explains most of dense's wins. **Before concluding hybrid isn't working, ensure data parity.**

### 3. Use Query Classification, Not One-Size-Fits-All

Instead of picking a single approach, classify queries:

```javascript
// Auto-strategy selection
if (hasExactMetric(query))     return 'hybrid-bm25';  // Q3 revenue
if (isStrategicQuestion(query)) return 'dense-only';  // AI strategy
if (isComparison(query))        return 'multi-query'; // AMD vs NVDA
return 'hybrid-bm25';  // Default for financial app
```

### 4. Hybrid is Significantly Faster

Counter to expectations, our hybrid queries averaged 248ms vs dense's 425ms—**42% faster**. Pinecone's native sparse+dense scoring is well-optimized.

### 5. Keep Both Indexes (For Now)

Despite initial advice to consolidate, maintaining both indexes during migration lets you:
- A/B test approaches
- Fall back if one fails
- Gradually shift traffic as confidence grows

---

## The Migration Checklist

If you're migrating from dense-only to hybrid:

- [x] Create new index with `metric: dotproduct`
- [x] Build sparse vectorizer (BM25-style hash-based)
- [x] Re-embed all data with dense + sparse vectors
- [x] Update query code to include sparse vectors
- [x] Run A/B evaluation comparing both approaches
- [ ] Achieve data parity (hybrid has 16% of dense vectors)
- [ ] Tune alpha for your specific use case
- [ ] Route queries to optimal strategy based on type
- [ ] Gradual migration once hybrid catches up on coverage

---

## Code & Resources

- [Hybrid embedding script](../scripts/embed-hybrid.js)
- [Dense vs Hybrid comparison](../scripts/compare-dense-vs-hybrid.js)
- [Pinecone hybrid search docs](https://docs.pinecone.io/guides/data/query-data#query-with-sparse-and-dense-vectors)

---

## What's Next?

1. **Data Parity**: Re-embed all transcript text (not just structured data) to hybrid index
2. **Reranking**: Add Cohere/Jina reranker as post-retrieval step  
3. **Query expansion**: Generate multiple query variations, merge results with RRF
4. **Adaptive alpha**: Use LLM to pick alpha based on query type (already implemented!)

### The Real Lesson

The journey from dense-only to hybrid taught me that RAG isn't about picking the "best" retrieval method—it's about:

1. **Understanding your query distribution** (mostly metrics? mostly strategic?)
2. **Ensuring data coverage** (the best algorithm can't find data that isn't there)
3. **Measuring what matters** (latency, accuracy, user satisfaction)
4. **Building flexibility** (query routing > one-size-fits-all)

For financial RAG specifically: **exact quarter/year matching is critical**. Hybrid search catches these cases that dense misses. But don't throw out dense—it still excels at the conceptual queries that matter for investment analysis.

---

*Evaluation run: December 2024 | 10 test queries | LLM-judged quality*
*Full results: [dense-vs-hybrid-comparison.json](../dense-vs-hybrid-comparison.json)*

