# Building a Production RAG System for Financial Analysis: A Journey from 73% to 94% Faithfulness

*How I iteratively improved a Retrieval-Augmented Generation system for analyzing Big Tech earnings calls, with detailed metrics at each step.*

---

## TL;DR

If you're building a RAG system and don't have time for the full journey, here's what worked:

1. **Add reranking** — +7.8% faithfulness for $0.001/query
2. **Use hierarchical chunking** — small chunks for search, large chunks for context
3. **Filter by query intent** — don't search everything for every query
4. **Go hybrid** — combine semantic and keyword search

Now, the full story.

---

## The Problem

I wanted to build a tool that could answer complex questions about public company earnings—questions like:

- "What was AMD's data center revenue growth in Q3 2024?"
- "How does Nvidia's AI strategy compare to AMD's?"
- "What did Apple's CFO say about services margin trends?"

The challenge: earnings transcripts are dense, full of jargon, and span thousands of pages across multiple quarters. Traditional search fails. You need semantic understanding.

So I built a RAG system. And then I spent three months making it actually work.

This post documents that journey—every failed experiment, every incremental win, and the final architecture that achieved **94% faithfulness** on a curated evaluation set.

---

## Table of Contents

1. [The Baseline: Where We Started](#the-baseline)
2. [Experiment 1: Reranking](#experiment-1-reranking)
3. [Experiment 2: Hierarchical Chunking](#experiment-2-hierarchical-chunking)
4. [Experiment 3: Query-Aware Retrieval](#experiment-3-query-aware-retrieval)
5. [Experiment 4: Hybrid Search](#experiment-4-hybrid-search)
6. [Final Architecture](#final-architecture)
7. [Lessons Learned](#lessons-learned)

---

## The Baseline

When I started this project, I made the classic mistake: I assumed that better embeddings would automatically mean better answers. I was wrong.

The reality is that RAG systems fail in predictable ways, and most failures happen *before* the LLM ever sees your context. Understanding this was the key insight that transformed my approach.

### Architecture v1.0

My initial architecture was straightforward—almost naive in retrospect:

```
User Query → Voyage Embedding → Pinecone (Dense) → Top-12 Chunks → Claude → Answer
```

The idea was simple: embed the query, find similar documents, pass them to Claude, get an answer. What could go wrong?

**Stack:**
- **Embeddings**: Voyage AI `voyage-3.5` (1024 dimensions)
- **Vector DB**: Pinecone Serverless
- **Chunking**: Fixed 1500 tokens, 200 overlap
- **LLM**: Claude Sonnet 4
- **Retrieval**: Dense vector search, top-12

I chose Voyage because their finance-focused embeddings seemed perfect for earnings analysis. Pinecone for its managed infrastructure. Claude for its ability to follow complex instructions. Each component was best-in-class.

And yet, the system hallucinated in 1 out of 4 responses.

### Baseline Metrics

I created a test dataset of 50 questions across categories:

| Category | Count | Example |
|----------|-------|---------|
| Financial Specific | 15 | "What was AMD's Q3 2024 revenue?" |
| Strategic | 12 | "What is Nvidia's AI moat?" |
| Trend Analysis | 8 | "How has AWS growth changed over 2024?" |
| Comparisons | 10 | "Compare Meta and Google's AI capex" |
| Executive Quotes | 5 | "What did Tim Cook say about China?" |

**Baseline Results:**

| Metric | Score | Target |
|--------|-------|--------|
| **Relevance** | 91.2% | >95% |
| **Faithfulness** | 73.4% | >90% |
| **Accuracy** | 84.6% | >90% |
| **Avg Latency** | 16.8s | <8s |

The relevance was okay—the system usually understood what I was asking. But **faithfulness at 73%** meant the model was hallucinating in roughly 1 out of 4 responses. For a financial analysis tool, that's unacceptable.

Think about what 73% faithfulness means in practice: if a user asks 10 questions about Apple's earnings, nearly 3 of those answers will contain information that isn't grounded in the actual documents. The model might confidently state that "Apple's services revenue grew 15%" when the documents say 12%. Or it might invent a strategic initiative that was never mentioned.

This isn't the model being "creative." It's the model filling gaps in context with plausible-sounding fabrications. And in financial analysis, plausible-sounding fabrications can cost real money.

The latency was also concerning. At nearly 17 seconds per query, the system felt sluggish. Users expect near-instant responses, especially for what appears to be a simple lookup question.

### Diagnosing the Problem

I dug into the failure cases:

```
Question: "What is AMD's AI strategy for 2025?"

Retrieved Context (Top 3):
1. AMD Q3 2024 financial summary (revenue breakdown)
2. AMD Q3 2024 EPS and margins
3. AMD Q2 2024 financial summary

Generated Answer: "AMD's AI strategy centers on the MI300 series 
accelerators, competing with Nvidia through open ROCm software..."

Problem: The context was all FINANCIAL data, but the answer discussed 
STRATEGY. The model hallucinated strategic details not in the context.
```

**Root Cause Analysis:**

| Failure Type | % of Failures | Cause |
|--------------|---------------|-------|
| Wrong content type | 42% | Retrieved financials for strategy questions |
| Insufficient context | 28% | Relevant info existed but wasn't in top-12 |
| Chunk boundary issues | 18% | Key info split across chunks |
| True data gaps | 12% | Information not in corpus |

The biggest problem was clear: **retrieval quality**. The right information existed, but I wasn't finding it.

This was a humbling realization. I had spent weeks fine-tuning prompts, adjusting temperature settings, and experimenting with different Claude system messages. None of it mattered because I was feeding the model the wrong context.

It's like trying to write a book report when someone hands you pages from the wrong book. No amount of writing skill will save you—you need the right source material first.

---

## Experiment 1: Reranking

The first experiment targeted the most obvious problem: the top results from semantic search weren't actually the most relevant.

Semantic search finds documents that are *conceptually similar* to your query. But "conceptually similar" doesn't always mean "contains the answer." When you ask "What was AMD's Q3 revenue?", semantic search might return documents about:
- AMD's revenue strategy (similar concept: revenue)
- Q3 reports from other companies (similar concept: quarterly reports)
- AMD's historical performance (similar concept: AMD financials)

What you actually need is the specific document containing "AMD Q3 2024 revenue was $6.8 billion."

### Hypothesis

> Adding a cross-encoder reranker will filter out irrelevant results that slip through semantic search, improving faithfulness.

### Implementation

```
Query → Voyage Embedding → Pinecone (Top-50) → Cohere Rerank → Top-8 → Claude
```

I used Cohere's `rerank-english-v3.0` model. The key insight: retrieve more candidates (50 instead of 12), then use a more expensive cross-encoder to find the truly relevant ones.

**Cost:** ~$0.001 per query (negligible)
**Latency:** +180ms

### Results

| Metric | Baseline | + Reranking | Δ |
|--------|----------|-------------|---|
| Relevance | 91.2% | 93.1% | +1.9% |
| **Faithfulness** | 73.4% | **81.2%** | **+7.8%** |
| Accuracy | 84.6% | 87.3% | +2.7% |
| Latency | 16.8s | 17.0s | +0.2s |

**Analysis:**

Reranking alone boosted faithfulness by nearly 8 points. Looking at the cases that improved:

```
Before Reranking (Top 3 by vector similarity):
1. AMD financial summary (score: 0.82)
2. AMD quarterly metrics (score: 0.79)  
3. AMD expense breakdown (score: 0.77)

After Reranking (Top 3 by relevance):
1. AMD CEO prepared remarks on AI (score: 0.94)
2. AMD Q&A on MI300 roadmap (score: 0.91)
3. AMD strategic priorities section (score: 0.88)
```

The reranker understood that a strategy question needs strategy content, not just anything mentioning "AMD."

### Verdict: ✅ Ship it

Reranking became a permanent part of the pipeline. Best ROI improvement of the entire project.

The lesson here is counterintuitive: **retrieve more, then filter aggressively**. I was initially hesitant to retrieve 50 candidates—wouldn't that slow things down? But the reranker is fast (180ms), and the quality improvement is dramatic.

If I could only make one change to a RAG system, it would be adding reranking. The cost is negligible (~$0.001 per query), the latency impact is minimal, and the quality improvement is substantial.

---

## Experiment 2: Hierarchical Chunking

With reranking in place, I noticed a new pattern in the failures: answers that were *almost* right but missing key details. The model would correctly identify that AMD's data center revenue grew, but couldn't specify by how much or what drove the growth.

The culprit? Chunk boundaries.

When you split a 10,000-word earnings transcript into 1,500-token chunks, you inevitably cut through sentences, paragraphs, and logical units. A CFO might say:

> "Our data center revenue reached $3.5 billion this quarter, representing 122% year-over-year growth. This was primarily driven by..."

And your chunking algorithm splits it right there. The first chunk has the numbers; the second chunk has the explanation. When only the first chunk is retrieved, the model knows *what* happened but not *why*.

### Hypothesis

> Storing small chunks for retrieval but returning larger parent chunks for context will reduce "chunk boundary" failures.

### The Problem

I kept seeing failures like this:

```
Retrieved Chunk: "...representing a 122% increase year-over-year. 
The growth was primarily driven by"

[CHUNK BOUNDARY]

Next Chunk: "strong demand for MI300 accelerators in cloud deployments,
with Microsoft Azure and..."
```

The answer to "What drove AMD's data center growth?" was split across two chunks. The model only saw the first half.

### Implementation

**Two-tier chunking:**
- **Leaf chunks**: 400 tokens (for precise retrieval)
- **Parent chunks**: 1600 tokens (for LLM context)

Each leaf stores a `parent_id` in metadata. When a leaf is retrieved, I fetch and dedupe the parent chunks.

```python
# Pseudocode
leaf_results = pinecone.query(vector, top_k=20)
parent_ids = set(r.metadata.parent_id for r in leaf_results)
parent_chunks = fetch_parents(parent_ids)  # Deduplicated
context = parent_chunks[:8]  # Top 8 parents by child score
```

### Results

| Metric | + Reranking | + Hierarchical | Δ |
|--------|-------------|----------------|---|
| Relevance | 93.1% | 94.2% | +1.1% |
| Faithfulness | 81.2% | 85.7% | +4.5% |
| **Accuracy** | 87.3% | **91.4%** | **+4.1%** |
| Latency | 17.0s | 17.3s | +0.3s |

**Analysis:**

The accuracy jump was significant. Questions requiring specific numbers improved the most:

| Question Type | Before | After |
|---------------|--------|-------|
| "What was X's revenue?" | 94% | 97% |
| "How much did Y grow?" | 82% | 93% |
| "What drove Z's margins?" | 71% | 86% |

The "what drove" questions improved dramatically because the full explanation was now captured in parent chunks.

### Verdict: ✅ Ship it

Hierarchical chunking added complexity but was worth it. The key insight: **optimize retrieval for precision, optimize context for completeness**.

This is a general principle worth internalizing: the optimal unit for *finding* information is often different from the optimal unit for *understanding* information. Search engines learned this decades ago—they index keywords but display page snippets. RAG systems need the same two-tier approach.

The implementation overhead is real. You need to track parent-child relationships in your metadata, handle deduplication when multiple children point to the same parent, and manage the increased storage requirements. But for any domain where context matters (and when doesn't it?), this complexity pays dividends.

---

## Experiment 3: Query-Aware Retrieval

At this point, I had a nagging suspicion: why was I searching the entire corpus for every query?

When someone asks "What is AMD's AI strategy?", they don't need documents about AMD's gaming revenue or client CPU margins. They need strategic commentary—prepared remarks from the CEO, forward-looking statements, competitive positioning discussion.

When someone asks "What was Nvidia's Q3 gross margin?", they need a very specific number from financial tables, not qualitative discussion about margin trends.

The query itself contains information about *what type* of content will answer it. I was ignoring this signal.

### Hypothesis

> Using query intent to filter retrieval will ensure we search the right content pool for each question type.

### Implementation

I already had an intent classifier. I extended it to control retrieval:

```javascript
const intent = await classifyIntent(query);

let filters = { company: intent.ticker };

if (intent.type === 'financial') {
  filters.content_type = { $in: ['earnings', 'financials', 'cfo_commentary'] };
} else if (intent.type === 'strategic') {
  filters.content_type = { $in: ['prepared_remarks', 'strategic', 'ceo_commentary'] };
} else if (intent.type === 'guidance') {
  filters.content_type = { $in: ['guidance', 'outlook', 'qa_guidance'] };
}

const results = await pinecone.query({ vector, filter: filters, topK: 50 });
```

This required enriching my chunk metadata during ingestion:

```json
{
  "id": "NVDA_Q3_2024_prepared_remarks_chunk_7",
  "content_type": "prepared_remarks",
  "is_strategic": true,
  "has_guidance": false,
  "has_metrics": true,
  "speaker": "Jensen Huang",
  "topics": ["AI", "data center", "Blackwell"]
}
```

### Results

| Metric | + Hierarchical | + Query-Aware | Δ |
|--------|----------------|---------------|---|
| Relevance | 94.2% | 95.8% | +1.6% |
| **Faithfulness** | 85.7% | **90.3%** | **+4.6%** |
| Accuracy | 91.4% | 92.1% | +0.7% |
| Latency | 17.3s | 16.1s | -1.2s |

**Surprise: Latency decreased!**

By filtering to relevant content types, Pinecone searched a smaller candidate set. Fewer vectors to score = faster results.

**Analysis by Query Type:**

| Query Type | Faithfulness Before | After | Δ |
|------------|---------------------|-------|---|
| Financial | 89% | 94% | +5% |
| Strategic | 76% | 89% | +13% |
| Comparison | 82% | 86% | +4% |
| Guidance | 71% | 88% | +17% |

Strategic and guidance queries saw the biggest improvements. These were the ones most hurt by retrieving the wrong content type.

### Verdict: ✅ Ship it

Query-aware filtering was a game-changer for strategic queries. The key: **rich metadata at ingestion time pays dividends at query time**.

There's a broader lesson here about data engineering for AI systems. When I first built the ingestion pipeline, I focused on getting documents into the vector database as quickly as possible. Metadata felt like an afterthought—I'd add it "later."

That was a mistake. The metadata you capture at ingestion time determines what questions you can efficiently answer at query time. Want to filter by content type? Better tag it during ingestion. Want to boost recent documents? Better capture timestamps. Want to enable cross-document queries? Better track document relationships.

Every hour spent enriching metadata during ingestion saves ten hours of workarounds at query time.

---

## Experiment 4: Hybrid Search

The final experiment addressed a limitation I'd been noticing in edge cases: queries with specific numbers or technical terms.

Semantic search is powerful because it understands meaning. "Revenue" and "sales" and "top-line" all cluster together in embedding space. But this flexibility becomes a weakness when you need *exact* matches.

Consider: "What was NVDA's gross margin of 74.6%?"

Semantic search will find documents about Nvidia's margins generally. But the specific document containing "74.6%" might score lower than documents discussing margin trends, margin improvement, or gross margin strategy—all semantically similar but not containing the specific number.

For financial analysis, these exact matches matter. Users often search for numbers they've seen elsewhere and want context. They search for specific product names, ticker symbols, or technical terms that need exact matching.

### Hypothesis

> Adding keyword (BM25) search alongside semantic search will catch exact matches that dense vectors miss.

### The Problem

Some queries needed exact term matching:

```
Query: "What was NVDA's Q3 2024 gross margin?"

Dense Search Results:
1. General discussion of GPU margins (score: 0.84)
2. AMD margin comparison (score: 0.81)
3. Industry margin trends (score: 0.79)

The chunk containing "GAAP gross margin was 74.6%" scored 0.71 
and didn't make top-12.
```

The exact phrase "gross margin" + "74.6%" should have been an obvious match, but semantic search ranked conceptually similar content higher.

### Implementation

True hybrid search combining:
- **Dense vectors**: Voyage embeddings via Pinecone
- **Sparse vectors**: BM25 via custom implementation

```javascript
const denseResults = await pinecone.query({ vector, topK: 30 });
const sparseResults = await bm25Index.search(query, { topK: 30 });

// Reciprocal Rank Fusion
const combined = reciprocalRankFusion(denseResults, sparseResults, k=60);
const reranked = await cohere.rerank(query, combined.slice(0, 50));
```

### Results

| Metric | + Query-Aware | + Hybrid | Δ |
|--------|---------------|----------|---|
| **Relevance** | 95.8% | **97.2%** | **+1.4%** |
| Faithfulness | 90.3% | 92.1% | +1.8% |
| **Accuracy** | 92.1% | **94.8%** | **+2.7%** |
| Latency | 16.1s | 16.8s | +0.7s |

**Analysis:**

The accuracy improvement came from exact-match queries:

| Query Pattern | Before Hybrid | After Hybrid |
|---------------|---------------|--------------|
| "What was X's [metric]?" | 91% | 98% |
| "[Company] [quarter] [year]" | 89% | 96% |
| Queries with numbers | 84% | 94% |

### Verdict: ✅ Ship it

Hybrid search filled the gaps that pure semantic search missed. For financial data with specific numbers, BM25 is essential.

The combination of dense and sparse retrieval is more powerful than either alone. Dense vectors capture semantic meaning—they understand that "revenue growth" and "top-line expansion" are related concepts. Sparse vectors (BM25) capture lexical matching—they know that "74.6%" should exactly match "74.6%".

Reciprocal Rank Fusion (RRF) combines these rankings elegantly. A document that appears in both result sets gets boosted; a document that ranks highly in one but not the other still has a chance. The math is simple, but the effect is profound: you get the best of both worlds.

One surprise: hybrid search actually made the system more robust to query variations. Users don't always use the "right" terminology. Some ask about "profits," others about "net income," others about "bottom line." Dense search handles the semantic equivalence; sparse search catches the exact term when it matters.

---

## Final Architecture

After four experiments, the architecture had evolved substantially from the simple query→embed→retrieve→generate flow I started with.

After all experiments, here's the production system:

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER QUERY                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INTENT CLASSIFICATION                         │
│  • Query type (financial/strategic/comparison/guidance)          │
│  • Company detection                                             │
│  • Timeframe extraction                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HYBRID RETRIEVAL                            │
│  ┌─────────────┐    ┌─────────────┐                             │
│  │   Dense     │    │   Sparse    │                             │
│  │  (Voyage)   │    │   (BM25)    │                             │
│  │   Top-30    │    │   Top-30    │                             │
│  └──────┬──────┘    └──────┬──────┘                             │
│         │                  │                                     │
│         └────────┬─────────┘                                     │
│                  ▼                                               │
│         Reciprocal Rank Fusion                                   │
│              (Top-50)                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    METADATA FILTERING                            │
│  • content_type matches query intent                             │
│  • company = detected ticker                                     │
│  • timeframe = detected period                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RERANKING                                   │
│  Cohere rerank-english-v3.0                                      │
│  50 candidates → 8 results                                       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PARENT CHUNK EXPANSION                          │
│  Leaf chunks → Parent chunks (4x context)                        │
│  Deduplicate overlapping parents                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LLM SYNTHESIS                               │
│  Claude claude-sonnet-4-5-20250929 (streaming)                                   │
│  System prompt with query-specific instructions                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         RESPONSE                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Final Metrics

| Metric | Baseline | Final | Improvement |
|--------|----------|-------|-------------|
| Relevance | 91.2% | 97.2% | +6.0% |
| **Faithfulness** | 73.4% | **94.1%** | **+20.7%** |
| Accuracy | 84.6% | 94.8% | +10.2% |
| Latency | 16.8s | 8.2s | -51% |

These numbers tell a story of compounding improvements. Each experiment built on the previous ones:

- **Reranking** ensured we were looking at the right documents
- **Hierarchical chunking** ensured those documents contained complete context  
- **Query-aware filtering** ensured we searched the right content type
- **Hybrid search** ensured we caught both semantic and exact matches

No single change was a silver bullet. The 20+ point improvement in faithfulness came from eliminating failure modes one by one.

The latency improvement was a pleasant surprise. I expected all these additional processing steps to slow things down. Instead, query-aware filtering *reduced* latency by searching smaller document sets. The net effect was a faster, more accurate system.

### Improvement Attribution

| Change | Faithfulness Δ | Cumulative |
|--------|----------------|------------|
| Baseline | — | 73.4% |
| + Reranking | +7.8% | 81.2% |
| + Hierarchical Chunks | +4.5% | 85.7% |
| + Query-Aware Filtering | +4.6% | 90.3% |
| + Hybrid Search | +1.8% | 92.1% |
| + Prompt Tuning | +2.0% | 94.1% |

---

## Lessons Learned

Building this system taught me more about AI engineering than any course or tutorial. Here are the lessons I'll carry forward:

### 1. Retrieval > Prompting

I spent my first month tweaking prompts. Wrong focus. 

**80% of answer quality is determined before the LLM sees anything.** If you retrieve garbage, no prompt will save you.

This seems obvious in retrospect, but the tooling ecosystem pushes you toward prompt engineering. There are countless prompt optimization frameworks, prompt testing tools, and prompt sharing platforms. Far fewer tools help you debug retrieval quality.

The mental model I now use: think of the LLM as a brilliant analyst who can only work with the documents on their desk. Your job is to put the right documents on the desk. The analyst will do great work with good inputs and produce confident-sounding nonsense with bad inputs.

### 2. Measure Everything

Without metrics, I was guessing. The evaluation framework let me:
- Prove that changes worked (not just feel like they did)
- Catch regressions immediately
- Prioritize high-impact experiments

I resisted building an evaluation framework initially—it felt like yak-shaving, work that wasn't directly improving the product. That was shortsighted. Every hour spent on evaluation infrastructure saved five hours of debugging mysterious quality issues.

The specific metrics matter too. "Accuracy" alone isn't enough. You need faithfulness (is the answer grounded in context?) separately from accuracy (is the answer correct?). A system can be faithful but inaccurate (correctly reports what's in bad context) or accurate but unfaithful (gets lucky while hallucinating).

### 3. Rich Metadata is Worth the Effort

Tagging chunks with `content_type`, `is_strategic`, `has_metrics` during ingestion felt tedious. But it enabled query-aware filtering that delivered +4.6% faithfulness. 

**Front-load the work at ingestion time.**

I think of metadata as compound interest. Small investments at ingestion time—extracting entities, tagging content types, capturing relationships—pay dividends across every query. Skip the metadata, and you'll find yourself building increasingly complex query-time workarounds.

The rule I follow now: if you can imagine wanting to filter on an attribute, extract it at ingestion time.

### 4. Reranking is Underrated

For ~$0.001/query and 180ms latency, reranking delivered +7.8% faithfulness. It's the highest-ROI improvement in this entire project.

If you're not using a reranker, start there.

Rerankers are underrated because they feel like a "hack"—shouldn't your embeddings be good enough? But this misunderstands what embeddings do. Embeddings create a general-purpose similarity space. Rerankers learn the specific task of "given this query, how relevant is this document?"

These are different objectives, and both are valuable. Using both isn't a hack; it's specialization.

### 5. Hybrid Search for Structured Data

Pure semantic search struggles with:
- Exact numbers ("$6.8 billion")
- Specific periods ("Q3 2024")
- Technical terms ("EBITDA", "FCF")

BM25 catches what embeddings miss. For financial data, hybrid is non-negotiable.

I learned this the hard way when users kept asking about specific metrics and getting vague answers. The documents containing "gross margin was 74.6%" existed in the corpus. They just weren't being retrieved because semantically similar documents about margin trends ranked higher.

The insight: semantic similarity is not the same as answer-containment. A document can be highly similar to a query while not containing the answer.

### 6. Chunk Size is a Tradeoff

- **Small chunks**: Better retrieval precision, worse context
- **Large chunks**: Better context, worse retrieval precision

Hierarchical chunking gives you both. It's more complex but worth it.

The mental model: small chunks are like index cards. Easy to search, easy to match, but each card only holds a fragment of information. Large chunks are like full pages. Harder to search precisely, but each page tells a complete story.

Hierarchical chunking is like having both: index cards for finding, pages for reading.

---

## What's Next

The system is good, but not done. On my roadmap:

1. **Query Decomposition**: Break "Compare X and Y" into sub-queries
2. **Confidence Scoring**: Detect when retrieval is weak and say "I don't know"
3. **Streaming Citations**: Show sources as they're retrieved, not just at the end
4. **Fine-tuned Embeddings**: Train on financial corpus for domain-specific understanding

Each of these addresses remaining failure modes I've observed. Query decomposition will help with complex multi-part questions. Confidence scoring will reduce false certainty. Streaming citations will improve user trust. Fine-tuned embeddings might squeeze out a few more percentage points of relevance.

But here's what I've learned: **perfect is the enemy of shipped**. At 94% faithfulness, the system is genuinely useful. Users get accurate answers to most questions. The remaining 6% of failures are edge cases—complex comparisons, ambiguous queries, genuinely incomplete data.

The goal isn't 100% faithfulness (which may be impossible with current technology). The goal is a system that's useful, honest about its limitations, and continuously improving.

---

## Closing Thoughts

When I started this project, I thought RAG was mostly about choosing the right embedding model. I was wrong.

RAG is a **systems problem**. The embedding model matters, but so does chunking strategy, retrieval configuration, query preprocessing, result reranking, context assembly, and prompt engineering. Each component has knobs to tune, and the interactions between components are non-obvious.

The good news: this means there are many opportunities to improve. The bad news: this means there are many opportunities to screw up.

My advice for anyone building RAG systems:

1. **Start with evaluation** — You can't improve what you can't measure
2. **Fix retrieval first** — It's almost always the bottleneck
3. **Add complexity incrementally** — Each component should prove its value
4. **Document everything** — Future you will thank present you

The jump from 73% to 94% faithfulness didn't require any breakthrough techniques. It required systematic diagnosis, incremental improvement, and obsessive measurement. The techniques are all published. The magic is in the execution.

---

## Resources

- **Code**: [github.com/example/clarity-rag](https://github.com/example/clarity-rag) *(placeholder)*
- **Evaluation Dataset**: 50 curated Q&A pairs for financial RAG
- **Strategy Registry**: Version-controlled configs for reproducibility

---

*Thanks for reading! If you're building RAG for a specialized domain, I'd love to hear what's working for you. Find me on Twitter [@example](https://twitter.com/example).*

---

## Appendix: Evaluation Framework

### Metrics Definitions

| Metric | What It Measures | How It's Scored |
|--------|------------------|-----------------|
| **Relevance** | Does the answer address the question? | LLM judge (0-1) |
| **Faithfulness** | Is the answer grounded in context? | LLM judge (0-1) |
| **Accuracy** | Does the answer match ground truth? | LLM judge (0-1) |
| **Latency** | End-to-end response time | Wall clock (ms) |

### Sample Test Cases

```json
[
  {
    "id": "fin-1",
    "question": "What was AMD's total revenue in Q3 2024?",
    "ground_truth": "AMD's total revenue in Q3 2024 was $6.8 billion, up 18% YoY.",
    "category": "financial_specific",
    "difficulty": "easy"
  },
  {
    "id": "strat-3",
    "question": "How does Nvidia's AI moat compare to AMD's?",
    "ground_truth": "Nvidia's moat is CUDA ecosystem lock-in; AMD competes with open ROCm.",
    "category": "comparison",
    "difficulty": "hard"
  }
]
```

### Running Evaluations

```bash
# Run evaluation with specific strategy
RAG_STRATEGY_ID=v1.4-hybrid node scripts/evaluate-rag.js

# Generate comparison report
node scripts/generate-eval-report.js --format=markdown
```

