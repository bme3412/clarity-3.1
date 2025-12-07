# Building a Production-Grade RAG System: Lessons from Clarity 3.0

*How we improved retrieval quality, reduced latency, and built observability into a financial intelligence platform.*

---

## The Starting Point

Clarity started as a straightforward RAG application: embed earnings transcripts, store them in Pinecone, retrieve relevant chunks, and let Claude generate answers. It worked, but it had problems:

- **Time to First Token (TTFT):** 22+ seconds
- **Retrieval quality:** Dense-only search missing exact financial terms
- **User experience:** No visibility into what the system was doing
- **Data accuracy:** Wrong fiscal years returned for cross-company comparisons

This post covers the systematic improvements we made and the trade-offs involved in each decision.

---

## 1. Hybrid Search: Dense + Sparse Vectors

### The Problem

Dense embeddings are great at semantic similarity—"AI strategy" matches "machine learning initiatives." But they're terrible at exact matches. When a user asks about "MI300 sales" or "Q3 FY2025 revenue," dense search often misses these specific terms.

### The Solution

We implemented hybrid search combining:
- **Dense vectors** (Voyage 3.5, 1024 dimensions) for semantic understanding
- **Sparse vectors** (BM25-style) for keyword matching

```javascript
// Sparse vectorizer with financial term boosting
const boostTerms = {
  'revenue': 1.5, 'margin': 1.5, 'growth': 1.5,
  'earnings': 1.5, 'guidance': 1.5, 'outlook': 1.5
};
```

### The Trade-off

Hybrid search requires `dotproduct` metric in Pinecone, not `cosine`. This meant recreating our index and re-embedding all 11,929 vectors—a 70-minute migration. But the improvement in retrieval precision was worth it.

### Result

Queries containing specific product names (H100, Blackwell, EPYC), financial terms (gross margin, free cash flow), and time periods (Q3 FY2025) now return significantly more relevant results.

---

## 2. Model Selection: Opus vs Sonnet

### The Problem

We were using Claude Opus 4.5—the most capable model, but also the slowest. With an agentic architecture requiring 2+ LLM calls per query (one to select tools, one to generate the response), TTFT was over 22 seconds.

### The Decision

We switched to Claude Sonnet 4, which offers:
- 3-5x faster inference
- 95%+ of Opus quality for structured financial analysis
- Same tool-use capabilities

### The Trade-off

Sonnet occasionally produces slightly less nuanced analysis on complex multi-company comparisons. For a financial intelligence tool where speed matters, this trade-off made sense. For a research application requiring maximum reasoning depth, Opus might be worth the latency.

### Result

| Metric | Opus | Sonnet | Improvement |
|--------|------|--------|-------------|
| TTFT | 22.8s | 16.5s | 28% faster |
| Total Time | 30.0s | 20.9s | 30% faster |

We made the model configurable via environment variable, so users can choose based on their needs.

---

## 3. Fiscal Year Intelligence

### The Problem

Different companies have different fiscal year calendars:
- NVIDIA's fiscal year ends in January (so December 2025 is FY2026 Q3)
- Most other companies follow calendar year (December 2025 is FY2025 Q4)

When users asked to "compare NVDA vs AMD latest quarterly results," the system returned Q3 FY2025 for both—which was 9 months old for NVIDIA.

### The Solution

We added a `fiscalYear: "latest"` option to our financial tools that auto-detects each company's most recent available data:

```javascript
getMostRecentQuarter(ticker) {
  const available = this.listAvailable(ticker);
  // Sort by fiscal year descending, return most recent
  const sorted = available.sort((a, b) => 
    parseInt(b.fiscalYear) - parseInt(a.fiscalYear)
  );
  return sorted[0];
}
```

### The Trade-off

This adds a directory scan on each query when "latest" is specified. We cache the results, but there's still a small overhead. The alternative—hardcoding fiscal year mappings—would require maintenance every quarter.

### Result

Cross-company comparisons now correctly return:
- NVDA: Q3 FY2026 (most recent)
- AMD: Q3 FY2025 (most recent)
- AVGO: Q3 FY2025 (most recent)

---

## 4. Observability: Making the Black Box Transparent

### The Problem

Users had no idea what was happening during the 20-second wait. Was it searching? Thinking? Stuck?

### The Solution

We built comprehensive observability at every layer:

**Pipeline Stages**
```
[✓] Analyzing query
[✓] Searching 11,929 vectors  
[●] Generating response...
```

**Real-time Metrics Panel**
- Time to First Token
- Total response time
- Number of chunks retrieved
- Average relevance score
- Tool execution breakdown with latency

**Behind the Scenes Toggle**
- Actual chunks retrieved with text previews
- Tool calls with input/output
- System configuration (model, embedding, search type)

**Confidence Indicators**
```
✅ High confidence: Based on 10 verified sources
⚡ Moderate confidence: 5 sources found
⚠️ Limited data: Only 2 sources found
```

### The Trade-off

All this observability adds payload size to SSE streams and React state management complexity. We mitigated this by:
- Only showing metrics after response completes
- Making "Behind the Scenes" collapsed by default
- Using efficient delta updates rather than full state replacement

### Result

Users now understand exactly what the system is doing, which sources informed the answer, and how confident they should be in the results. This transforms a black-box AI into an auditable analysis tool.

---

## 5. Data Extraction: Handling Inconsistent Schemas

### The Problem

Our financial data came from multiple sources with inconsistent JSON structures:

```javascript
// Apple structure
margins.gross_margin.current_value: 46.5

// NVIDIA structure  
margins.gross_margin.gaap.value: 75.0

// Some files
gross_margin.value: 42.0
```

The original extractor only handled one format, causing "data not available" errors for metrics that actually existed.

### The Solution

We built a flexible extractor with fallback chains:

```javascript
let grossMargin = 0;
if (incomeStatement.margins?.gross_margin?.current_value) {
  grossMargin = incomeStatement.margins.gross_margin.current_value;
} else if (incomeStatement.margins?.gross_margin?.gaap?.value) {
  grossMargin = incomeStatement.margins.gross_margin.gaap.value;
} else if (incomeStatement.margins?.gross_margin?.value) {
  grossMargin = incomeStatement.margins.gross_margin.value;
}
```

### The Trade-off

More extraction paths means more code to maintain and more potential for subtle bugs. We chose explicit fallback chains over generic traversal because financial data requires precision—we need to know exactly which field we're reading.

### Result

Queries like "Apple gross margin trend" now return actual data (46.9% → 46.2%) instead of "data not available."

---

## 6. UX: Chat-Style Interface

### The Problem

The original interface had the input at the top and responses below—fine for single queries, but awkward for follow-up conversations. Users had to scroll up to ask another question.

### The Solution

We restructured to a chat-style layout:
- Response area scrolls (top)
- Input fixed at bottom
- Auto-scroll as content streams in
- Auto-focus input after response completes
- Dynamic placeholder: "Ask a follow-up question..."

### The Trade-off

This required restructuring the component hierarchy and adding refs for scroll management. The code is more complex, but the UX is dramatically better for multi-turn conversations.

### Result

Users can now have natural back-and-forth conversations without fighting the interface.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                      USER QUERY                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 CLAUDE SONNET (Agentic)                      │
│  • Analyzes query intent                                     │
│  • Selects tools: financial metrics / transcript search      │
│  • Generates response with citations                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌───────────────────┐       ┌───────────────────────────────┐
│   LOCAL JSON      │       │      PINECONE HYBRID          │
│   Structured      │       │  Dense (Voyage 3.5, 1024d)    │
│   financials      │       │  + Sparse (BM25 keywords)     │
└───────────────────┘       └───────────────────────────────┘
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  STREAMING RESPONSE                          │
│  • Token-by-token via SSE                                   │
│  • Real-time metrics                                        │
│  • Source citations                                         │
│  • Confidence indicators                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Time to First Token | 22.8s | 16.5s | 28% |
| Total Response Time | 30.0s | 20.9s | 30% |
| Retrieval Latency | 1.7s | 0.98s | 42% |
| Search Type | Dense only | Hybrid | Better recall |
| Observability | None | Full pipeline | Transparent |

---

## Lessons Learned

1. **Hybrid search is worth the complexity.** Dense embeddings alone miss too many exact matches in domain-specific applications.

2. **Model selection should match the use case.** Opus is impressive, but Sonnet at 3x the speed was the right choice for interactive analysis.

3. **Fiscal calendars are a hidden trap.** Any financial application comparing companies must handle different fiscal year definitions.

4. **Observability builds trust.** Users trust AI more when they can see what it's doing. Show the sources, show the confidence, show the latency.

5. **Schema flexibility matters.** Real-world data is messy. Build extractors that handle variation gracefully.

6. **UX details compound.** Moving the input to the bottom, auto-focusing after responses, showing pipeline stages—each small improvement makes the whole experience feel polished.

---

## What's Next

- **Caching common queries** to reduce latency for repeated questions
- **Streaming the "thinking" phase** to reduce perceived latency further
- **Evaluation framework** to systematically measure retrieval quality
- **Multi-modal support** for charts and tables in responses

---

*Clarity 3.0 is a portfolio project demonstrating production RAG patterns. The full source is available on GitHub.*
