# Scaling the Vector Database: From Single Ticker to Multi-Company RAG

*Pre-blog research notes and experiment ideas for improving embedding coverage and retrieval quality.*

---

## Analysis of Current Issues

### 1. Data Coverage Gap (Critical)

Most queries return `"matches": []` from Pinecone because **only AMD is embedded**:
- NVDA, AAPL, META, MSFT, AMZN, GOOGL → all returning empty results
- System falls back to local JSON files + keyword matching

**Evidence from eval:**
```
Evaluating: "How has Nvidia's data center revenue changed over the past year?"
Pinecone query result: { "matches": [] }
Transcript matches: 0
```

### 2. Hybrid Search Disabled

```
Pinecone index does not support sparse vectors. Retrying with dense-only search.
```

The Pinecone index wasn't created with sparse vector support, so BM25/hybrid search is failing silently.

### 3. Comparison Queries Fail Hard

```
"Compare Apple and Google's approaches to AI" 
→ Relevance: 0.00, Accuracy: 0.00
```

The system retrieved **AMD data** for an Apple/Google query because that's all that's embedded. This is a critical failure mode.

### 4. JSON Parsing Errors

```
Failed to parse financial JSON: SyntaxError: Unexpected non-whitespace character 
at position 12977 (line 491 column 4)
```

META Q3 2025 JSON is malformed. There may be other corrupted files.

### 5. Summary Metrics (Baseline Eval)

| Metric | Score | Target |
|--------|-------|--------|
| Avg Relevance | 0.77 | >0.90 |
| Avg Faithfulness | 0.77 | >0.90 |
| Avg Accuracy | 0.65 | >0.85 |
| Avg Latency | 19,536ms | <10,000ms |

---

## Ideas for Improvement

### A. Complete Data Ingestion First

Before changing architecture:

1. **Embed all tickers systematically**
   - Create a script that loops through all companies/quarters
   - Track progress in a manifest file

2. **Validate JSON files before embedding**
   - Syntax check
   - Schema validation
   - Required fields check

3. **Ingestion dashboard**
   - What's embedded vs. pending
   - Last updated timestamps
   - Error log

---

### B. Alternative Vector Database Options

| Database | Pros | Cons | Best For |
|----------|------|------|----------|
| **Pinecone** (current) | Managed, reliable, good docs | Sparse vectors require specific index config | Staying put if we fix the index |
| **Qdrant** | Native hybrid search, self-host or cloud, fast filtering | Smaller ecosystem | True hybrid without workarounds |
| **Weaviate** | Built-in BM25 + vector, GraphQL API | Heavier to self-host | Schema-first approach |
| **Chroma** | Dead simple, local-first | Not production-ready at scale | Rapid prototyping |
| **Milvus** | Very scalable, Zilliz cloud | Complex setup | High-volume production |
| **LanceDB** | Serverless, columnar, cheap | Newer, less battle-tested | Cost-sensitive apps |
| **Supabase pgvector** | SQL queries, familiar Postgres | Slower for pure vector | Already on Supabase |

**Recommendation:** Keep Pinecone but create a **new index with sparse vector support enabled**. OR try **Qdrant** as an A/B test since it handles hybrid search more elegantly.

---

### C. Architecture Experiments

#### Experiment 1: Fix Pinecone Hybrid Search

**Hypothesis:** Enabling sparse vectors will improve keyword-sensitive queries.

**Steps:**
1. Create new index: `clarity-hybrid` with `metric: dotproduct` and sparse enabled
2. Re-embed everything with both dense and sparse vectors
3. Compare dense-only vs. hybrid on eval set

**Expected Impact:** +5-10% accuracy on exact-match queries (revenue figures, product names)

---

#### Experiment 2: Multi-Index vs. Single Index

**Options:**
- **Option A:** One index, filter by `company_ticker` metadata
- **Option B:** Separate index per company (`clarity-amd`, `clarity-nvda`, etc.)

**Hypothesis:** Multi-index is faster for single-company queries but problematic for comparisons.

**Metrics to track:**
- Query latency (single company)
- Query latency (comparison)
- Relevance scores

---

#### Experiment 3: Namespace Strategy

Use Pinecone namespaces (one per company):
- Query single namespace for company-specific questions
- Query all namespaces for comparison/industry questions

**Pros:** Good middle-ground, no index duplication
**Cons:** Can't do cross-namespace filtering in single query

---

#### Experiment 4: Qdrant as Secondary Index

**Steps:**
1. Embed same data to both Pinecone and Qdrant
2. Implement query routing based on query type
3. A/B test on eval set

**Blog angle:** "Pinecone vs. Qdrant: A Hybrid Search Showdown"

---

### D. Retrieval Strategy Improvements

#### 1. Query Routing for Comparisons

**Problem:** "Compare AMD vs Nvidia" only queries one ticker.

**Solution:**
```javascript
if (isComparisonQuery) {
  const results1 = await queryPinecone(ticker1);
  const results2 = await queryPinecone(ticker2);
  return mergeResults(results1, results2);
}
```

#### 2. Cross-Company Queries

**Problem:** "What are trends in enterprise AI?" has no ticker, defaults to NVDA.

**Solution:** Search across ALL companies, rank by relevance, deduplicate.

#### 3. Time-Aware Retrieval

- Boost recent quarters in scoring
- Filter out old data for "latest" or "recent" queries
- Decay function: `score * (1 - age_in_quarters * 0.1)`

#### 4. Content-Type Routing

| Query Type | Prioritize |
|------------|-----------|
| Financial | `type: "earnings"` chunks |
| Strategic | `type: "qa"` chunks (analyst Q&A) |
| Product | `type: "prepared_remarks"` |
| Executive quotes | `type: "qa"` with speaker filter |

---

### E. Chunking Improvements

#### Current Strategy
- Fixed 1500 tokens
- 200 token overlap
- No semantic boundaries

#### Proposed Improvements

**1. Section-Aware Chunking**
- Keep "Prepared Remarks" and "Q&A" as separate logical units
- Don't split mid-sentence or mid-paragraph
- Respect document structure

**2. Hierarchical Chunking**
- Store small chunks (200 tokens) for precision retrieval
- Store large chunks (1500 tokens) for context
- Retrieve small → return parent large chunk

**3. Entity-Centric Chunking**
- Group content by entity (product names, metrics, executives)
- "MI300" mentions should cluster together
- Better for product-specific queries

---

### F. Blog Post Structure Ideas

#### Title Options
- "Building a Multi-Company Financial RAG: Lessons from Scaling Beyond One Ticker"
- "Pinecone vs. Qdrant: A Hybrid Search Showdown for Financial Analysis"
- "The 80% Problem: Why My RAG Worked for AMD but Failed for Everyone Else"
- "From 0.65 to 0.95 Accuracy: Fixing a Broken RAG Pipeline"

#### Narrative Arc

1. **The False Sense of Security**
   - AMD worked great, thought the system was production-ready
   - Shipped with confidence

2. **The Eval Exposed the Truth**
   - 0% accuracy on comparison queries
   - "Compare Apple and Google" returned AMD data
   - Most queries hitting empty results

3. **Root Cause Analysis**
   - Missing data (only 1 of 6 companies embedded)
   - No hybrid search (sparse vectors disabled)
   - Bad query routing (comparisons broken)

4. **The Fix**
   - Systematic ingestion pipeline
   - New index with proper config
   - Smarter query routing

5. **Results**
   - Before/after metrics table
   - Latency improvements
   - Lessons learned

---

### G. Immediate Action Items

| Priority | Task | Status |
|----------|------|--------|
| P0 | Fix META JSON parsing error | ✅ Done |
| P0 | Create ingestion script for all tickers | 🔲 Pending |
| P1 | Create new Pinecone index with sparse support | 🔲 Pending |
| P1 | OR: Set up Qdrant as alternative | 🔲 Pending |
| P2 | Implement comparison query routing | 🔲 Pending |
| P2 | Re-run eval with full data coverage | 🔲 Pending |
| P3 | Compare metrics: dense vs. hybrid vs. Qdrant | 🔲 Pending |
| P3 | Write blog post with findings | 🔲 Pending |

---

## Appendix: Raw Eval Results (Baseline)

```
Total Samples:      15
Avg Relevance:      0.77
Avg Faithfulness:   0.77
Avg Accuracy:       0.65
Avg Total Latency:  19535.87 ms
```

### Per-Query Breakdown

| Query | Relevance | Faithfulness | Accuracy | Notes |
|-------|-----------|--------------|----------|-------|
| AMD Q3 revenue | 1.00 | 0.95 | 1.00 | ✅ Working |
| AMD Data Center | 1.00 | 0.95 | 1.00 | ✅ Working |
| NVDA data center trend | 1.00 | 1.00 | 1.00 | ⚠️ No Pinecone matches |
| AMD AI strategy | 0.95 | 0.65 | 0.70 | ⚠️ Low faithfulness |
| AAPL AI approach | 0.85 | 0.75 | 0.30 | ❌ No Pinecone matches |
| META AI infra | 1.00 | 0.85 | 1.00 | ⚠️ JSON parse error |
| AMD vs NVDA | 0.70 | 0.95 | 0.30 | ❌ Only AMD data retrieved |
| AAPL vs GOOGL | 0.00 | 0.95 | 0.00 | ❌ Retrieved AMD data! |
| AAPL new products | 0.30 | 0.85 | 0.30 | ❌ No Pinecone matches |
| AMD MI300 | 1.00 | 0.30 | 1.00 | ⚠️ Very low faithfulness |
| MSFT cloud | 0.95 | 0.95 | 1.00 | ⚠️ No Pinecone matches |
| Enterprise AI trends | 0.85 | 0.95 | 0.30 | ❌ No ticker, bad routing |
| AMD CEO quote | 0.30 | 0.30 | 0.70 | ❌ No Pinecone matches |
| NVDA guidance | 0.70 | 0.85 | 0.85 | ⚠️ No Pinecone matches |
| AMZN AWS | 1.00 | 0.30 | 0.30 | ❌ No Pinecone, JSON error |

