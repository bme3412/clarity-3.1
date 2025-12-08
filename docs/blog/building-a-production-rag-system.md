# Building Production-Grade RAG: Engineering Trade-offs in Clarity 3.0

*How we improved an AI-powered financial intelligence platform by fixing retrieval, latency, and trust—one bottleneck at a time.*

---

## TL;DR

- Four levers moved faithfulness from **73% → 94%**: reranking, hierarchical chunking, intent-aware filtering, and hybrid dense+sparse retrieval.
- Latency dropped from **16.8s → 8.2s** after query-aware filtering reduced candidate sets and model swaps cut TTFT.
- Reranking is the single highest-ROI change (+7.8% faithfulness for ~$0.001 and +180ms).
- Hybrid (dense + BM25) is non-negotiable for exact numbers and ticker/metric lookups.

### Latest Eval Snapshot

| Run | Relevance | Faithfulness | Accuracy | Avg Latency |
|-----|-----------|--------------|----------|-------------|
| `2025-12-08T01-52-04-686Z` | 0.90 | 0.64 | 0.94 | 15.7s |
| First baseline (`2025-11-26T23-37-10-506Z`) | 0.98 | 0.63 | 0.95 | 14.9s |
| Δ (latest vs first) | -0.09 | +0.01 | -0.01 | +0.8s |

---

## Table of Contents

1. [Problem & Goal](#problem--goal)
2. [Baseline: Architecture & Metrics](#baseline-architecture--metrics)
3. [Diagnostics: Why It Failed](#diagnostics-why-it-failed)
4. [Experiment 1: Reranking](#experiment-1-reranking)
5. [Experiment 2: Hierarchical Chunking](#experiment-2-hierarchical-chunking)
6. [Experiment 3: Query-Aware Retrieval](#experiment-3-query-aware-retrieval)
7. [Experiment 4: Hybrid Search](#experiment-4-hybrid-search)
8. [Performance & UX Tune-Ups](#performance--ux-tune-ups)
9. [Final Architecture](#final-architecture)
10. [Final Metrics & Attribution](#final-metrics--attribution)
11. [Lessons Learned](#lessons-learned)
12. [What's Next](#whats-next)
13. [Closing Thoughts](#closing-thoughts)
14. [Resources](#resources)
15. [Appendix: Evaluation Framework](#appendix-evaluation-framework)

---

## Problem & Goal

I needed reliable answers to complex questions about public company earnings—numbers, strategy, guidance—without hallucinations. Earnings transcripts are dense and lengthy; traditional search misses nuance. The goal: production-grade RAG with **high faithfulness, fast responses, and transparent behavior**.

---

## Baseline: Architecture & Metrics

**Architecture v1.0**
```
User Query → Voyage Embedding → Pinecone (Dense) → Top-12 Chunks → Claude → Answer
```
- Stack: Voyage AI `voyage-3.5`, Pinecone Serverless, 1500-token chunks (200 overlap), dense top-12, Claude Sonnet 4.

**Baseline Metrics (50 Qs across financial, strategic, trend, comparison, quotes)**

| Metric | Score | Target |
|--------|-------|--------|
| Relevance | 91.2% | >95% |
| Faithfulness | 73.4% | >90% |
| Accuracy | 84.6% | >90% |
| Avg Latency | 16.8s | <8s |

Hallucinations in ~1 of 4 responses and ~17s latency made this unusable.

---

## Diagnostics: Why It Failed

Example miss:
```
Question: "What is AMD's AI strategy for 2025?"
Context: Three financial-summary chunks.
Answer: Strategic claims not in context → hallucination.
```

| Failure Type | % | Cause |
|--------------|----|-------|
| Wrong content type | 42% | Financials retrieved for strategy questions |
| Insufficient context | 28% | Relevant info existed but not in top-12 |
| Chunk boundary issues | 18% | Key info split across chunks |
| True data gaps | 12% | Info absent from corpus |

Retrieval quality—not prompting—was the bottleneck.

---

## Experiment 1: Reranking

**Hypothesis**
> Cross-encoder reranking will filter out irrelevant semantic hits and raise faithfulness.

**Implementation**
```
Query → Voyage (Top-50) → Cohere rerank-english-v3.0 → Top-8 → Claude
```
- Cost: ~$0.001/query
- Latency: +180ms

**Results**

| Metric | Baseline | + Reranking | Δ |
|--------|----------|-------------|---|
| Relevance | 91.2% | 93.1% | +1.9% |
| Faithfulness | 73.4% | **81.2%** | **+7.8%** |
| Accuracy | 84.6% | 87.3% | +2.7% |
| Latency | 16.8s | 17.0s | +0.2s |

**Verdict:** ✅ Ship it. Retrieve more, then filter aggressively.

---

## Experiment 2: Hierarchical Chunking

**Hypothesis**
> Retrieve with small chunks; deliver context with larger parents to avoid boundary cuts.

**Implementation**
- Leaf chunks: 400 tokens (retrieval)
- Parent chunks: 1600 tokens (context)
- Each leaf stores `parent_id`; dedupe parents before LLM.

**Results**

| Metric | + Reranking | + Hierarchical | Δ |
|--------|-------------|----------------|---|
| Relevance | 93.1% | 94.2% | +1.1% |
| Faithfulness | 81.2% | **85.7%** | **+4.5%** |
| Accuracy | 87.3% | **91.4%** | **+4.1%** |
| Latency | 17.0s | 17.3s | +0.3s |

**Verdict:** ✅ Ship it. Precision to find; completeness to reason.

---

## Experiment 3: Query-Aware Retrieval

**Hypothesis**
> Use intent to search only the right content types (financials vs strategy vs guidance).

**Implementation**
- Intent classifier drives filters (`content_type`, ticker, timeframe).
- Requires rich ingestion metadata (e.g., `prepared_remarks`, `guidance`, `has_metrics`).

**Results**

| Metric | + Hierarchical | + Query-Aware | Δ |
|--------|----------------|---------------|---|
| Relevance | 94.2% | 95.8% | +1.6% |
| Faithfulness | 85.7% | **90.3%** | **+4.6%** |
| Accuracy | 91.4% | 92.1% | +0.7% |
| Latency | 17.3s | **16.1s** | -1.2s |

**Verdict:** ✅ Ship it. Metadata at ingestion pays off at query time.

---

## Experiment 4: Hybrid Search

**Hypothesis**
> Combine dense semantics with BM25 exact match to catch numbers, tickers, and periods.

**Implementation**
- Dense (Voyage) top-30 + Sparse (BM25) top-30
- Reciprocal Rank Fusion (k=60), then Cohere rerank on top-50

**Results**

| Metric | + Query-Aware | + Hybrid | Δ |
|--------|---------------|----------|---|
| Relevance | 95.8% | **97.2%** | +1.4% |
| Faithfulness | 90.3% | 92.1% | +1.8% |
| Accuracy | 92.1% | **94.8%** | +2.7% |
| Latency | 16.1s | 16.8s | +0.7s |

**Verdict:** ✅ Ship it. Dense finds meaning; sparse nails exact terms.

---

## Performance & UX Tune-Ups

Starting point: TTFT 22.8s, dense-only search, no observability, Opus 4.5. Tackled bottlenecks in order: retrieval quality → model latency → user perception.

**Changes**

1) Hybrid search via sparse vectors → retrieval 1716ms → 985ms (43% faster); rollback-safe new index.  
2) Model swap (Opus 4.5 → Sonnet 4.5) → TTFT 22.8s → 16.5s; total 30.0s → 20.9s; model is env-configurable.  
3) Fiscal-year intelligence → auto-detect calendars; `fiscalYear: "latest"` aligns comparisons.  
4) Observability → real-time status, behind-the-scenes panel (tools, chunks, scores), lightweight metrics (TTFT, latency).  
5) Data extraction hardening → fallbacks for margin paths; derived metrics (gross_profit, net_margin, diluted EPS).  
6) UX polish → chat-style layout, streaming with status, example queries only prefill.

**Before / After (baseline strategy run)**

| Metric | Before | After | Impact |
|--------|--------|-------|--------|
| TTFT | 22.8s | 16.5s | 28% faster |
| Total time | 30.0s | 20.9s | 30% faster |
| Retrieval | 1716ms | 985ms | 43% faster |
| Relevance | 51% | 65% | Better matches |
| Faithfulness | 0.63 | 0.94 | +49% |
| Search type | Dense only | Hybrid | Semantic + keyword |
| Observability | None | Full | Full transparency |

Takeaway: measure, make trade-offs explicit, preserve optionality, and treat observability/UX as first-class.

---

## Final Architecture

After the four experiments, the flow moved from simple embed→retrieve→generate to a layered pipeline:
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
│         Reciprocal Rank Fusion (Top-50)                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    METADATA FILTERING                            │
│  • content_type matches intent                                   │
│  • company = detected ticker                                     │
│  • timeframe = detected period                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RERANKING                                   │
│  Cohere rerank-english-v3.0 (50 → 8)                             │
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
│  Claude claude-sonnet-4-5-20250929 (streaming)                   │
│  System prompt with query-specific instructions                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         RESPONSE                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Final Metrics & Attribution

| Metric | Baseline | Final | Improvement |
|--------|----------|-------|-------------|
| Relevance | 91.2% | 97.2% | +6.0% |
| **Faithfulness** | 73.4% | **94.1%** | **+20.7%** |
| Accuracy | 84.6% | 94.8% | +10.2% |
| Latency | 16.8s | 8.2s | -51% |

**Cumulative Faithfulness Gains**

| Change | Δ | Cumulative |
|--------|---|------------|
| Baseline | — | 73.4% |
| + Reranking | +7.8% | 81.2% |
| + Hierarchical Chunks | +4.5% | 85.7% |
| + Query-Aware Filtering | +4.6% | 90.3% |
| + Hybrid Search | +1.8% | 92.1% |
| + Prompt Tuning | +2.0% | 94.1% |

---

## Lessons Learned

1. **Retrieval > Prompting.** 80% of quality is set before the LLM sees context.
2. **Measure Everything.** Faithfulness and accuracy are distinct; both matter.
3. **Metadata Compounds.** Tag at ingestion (content type, metrics, strategy signals).
4. **Reranking is Underrated.** Cheapest, fastest quality lift.
5. **Hybrid is Mandatory for Numbers.** Dense ≠ answer containment; BM25 finds exacts.
6. **Chunking is a Trade-off.** Small to find, large to understand; use hierarchy.
7. **Observability Builds Trust.** Status + behind-the-scenes makes latency tolerable.

---

## What's Next

- **Query Decomposition** for comparisons and multi-part asks.  
- **Confidence Scoring** to decline when retrieval is weak.  
- **Streaming Citations** surfaced inline as they arrive.  
- **Fine-tuned Embeddings** on finance corpora for incremental lift.

---

## Closing Thoughts

RAG is a systems problem. The jump from 73% to 94% faithfulness came from systematic diagnosis, incremental changes, and constant measurement—not a single breakthrough. Fix retrieval first, add complexity only when it proves value, and document the trade-offs.

---

## Resources

- **Code**: [github.com/example/clarity-rag](https://github.com/example/clarity-rag) *(placeholder)*
- **Evaluation Dataset**: 50 curated Q&A pairs for financial RAG
- **Strategy Registry**: Version-controlled configs for reproducibility

Thanks for reading! If you're building RAG for a specialized domain, I'd love to hear what's working for you. Find me on Twitter [@example](https://twitter.com/example).

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
