# Clarity RAG Evaluation System

This document explains the evaluation pipeline used to track and measure improvements to our RAG (Retrieval-Augmented Generation) system for financial analysis.

## 🎯 Overview

The evaluation system provides:
- **Versioned Strategy Tracking**: Each RAG configuration is versioned and documented
- **Automated Metrics**: LLM-based evaluation of relevance, faithfulness, and accuracy
- **Historical Comparison**: Track improvements over time for blog posts/documentation
- **Reproducible Results**: Consistent test dataset and evaluation methodology

## 📊 Current Baseline (v1.0)

### Embedding Strategy
| Component | Configuration |
|-----------|---------------|
| **Model** | Voyage AI voyage-3.5 |
| **Dimensions** | 1024 |
| **Batch Size** | 10 |
| **Input Types** | `document` for indexing, `query` for search |

### Chunking Strategy
| Component | Configuration |
|-----------|---------------|
| **Strategy** | Semantic chunking |
| **Chunk Size** | 1500 tokens |
| **Overlap** | 200 tokens |
| **Special Handling** | JSON extraction for financial data, section-aware for transcripts |

### Retrieval Strategy
| Component | Configuration |
|-----------|---------------|
| **Vector DB** | Pinecone |
| **Index** | clarity-openai |
| **Search Type** | Dense vector (with BM25 sparse support) |
| **Top-K** | 12 results |
| **Hybrid Alpha** | 0.6 |
| **Reranking** | None (baseline) |
| **Filters** | company, fiscalYear, quarter, type |

### Synthesis
| Component | Configuration |
|-----------|---------------|
| **Model** | Claude claude-sonnet-4-5-20250929 |
| **Max Tokens** | 800 |
| **Temperature** | 0.7 |
| **Streaming** | Yes |

## 📈 Key Metrics

### Quality Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Relevance** | Does the answer address the user's question? | > 90% |
| **Faithfulness** | Is the answer grounded in retrieved context (no hallucination)? | > 85% |
| **Accuracy** | Does the answer match ground truth facts? | > 90% |

### Performance Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Total Latency** | End-to-end response time | < 10s |
| **Embedding Latency** | Time to generate query embedding | < 500ms |
| **Retrieval Latency** | Time to query Pinecone | < 2s |
| **LLM Latency** | Time for synthesis | < 8s |

### Current Baseline Results

```
Relevance:     98.3%  ✅ Exceeds target
Faithfulness:  73.3%  ⚠️ Below target (focus area)
Accuracy:      90.0%  ✅ Meets target
Avg Latency:   16.8s  ⚠️ Above target
```

## 🔬 Evaluation Methodology

### Test Dataset

The evaluation uses a curated dataset of 15 test cases across categories:

| Category | Count | Description |
|----------|-------|-------------|
| financial_specific | 2 | Specific financial metrics (revenue, EPS) |
| financial_trend | 1 | Multi-period financial analysis |
| strategic | 3 | Company strategy and initiatives |
| comparison | 2 | Multi-company comparisons |
| product | 2 | Product announcements and details |
| market | 2 | Market trends and analysis |
| executive_commentary | 1 | CEO/CFO statements |
| guidance | 1 | Forward-looking guidance |
| segment_analysis | 1 | Business segment performance |

### Evaluation Process

1. **Query Processing**: Send test question through RAG pipeline
2. **Context Retrieval**: Capture retrieved documents and metadata
3. **Answer Generation**: Generate response using LLM synthesis
4. **Metric Evaluation**: Use Claude to score each metric (0-1 scale)
5. **Aggregation**: Calculate averages and track over time

### Scoring Methodology

Each metric is evaluated by Claude with specific criteria:

**Relevance (Answer vs Question)**
- 1.0: Answer directly and completely addresses the question
- 0.5: Answer partially addresses the question
- 0.0: Answer is irrelevant or non-responsive

**Faithfulness (Answer vs Context)**
- 1.0: Answer completely derived from retrieved context
- 0.5: Answer partially supported by context
- 0.0: Answer contains hallucinations

**Accuracy (Answer vs Ground Truth)**
- 1.0: Answer matches ground truth facts
- 0.5: Answer partially correct
- 0.0: Answer contradicts ground truth

## 🚀 Running Evaluations

### Prerequisites
```bash
# Required environment variables
ANTHROPIC_API_KEY=...
VOYAGE_API_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=clarity-openai
```

### Run Evaluation
```bash
# Run with default strategy (baseline)
node scripts/evaluate-rag.js

# Run with specific strategy
RAG_STRATEGY_ID=hybrid-search node scripts/evaluate-rag.js
```

### Generate Reports
```bash
# Generate markdown report
node scripts/generate-eval-report.js --format=markdown

# Generate JSON export for blog
node scripts/generate-eval-report.js --format=json

# Generate all formats
node scripts/generate-eval-report.js --format=all
```

### Create New Strategy Version
```bash
# Create new strategy based on baseline
node scripts/create-strategy.js v1.1 hybrid-search --from baseline
```

## 📁 File Structure

```
src/lib/evaluation/
├── evaluator.js           # RAG evaluation logic
├── strategyRegistry.js    # Strategy version management
└── strategies/
    └── v1-baseline.json   # Baseline strategy definition

data/evaluation/
└── dataset.json           # Test cases

evaluation_reports/
├── baseline/              # Results per strategy
│   └── {run-id}/
│       ├── run.json       # Run summary
│       └── {case-id}.json # Individual case results
└── {strategy-name}/
    └── ...

docs/evaluations/
├── README.md              # This file
└── EVALUATION_REPORT.md   # Generated comparison report

scripts/
├── evaluate-rag.js        # Run evaluations
├── generate-eval-report.js # Generate reports
└── create-strategy.js     # Create new strategy versions
```

## 🎯 Improvement Roadmap

Based on baseline results, priority improvements:

### 1. Faithfulness (73.3% → 85%+)
- [ ] Add cross-encoder reranking to improve context relevance
- [ ] Implement parent-child chunking to preserve context
- [ ] Tune hybrid search alpha parameter

### 2. Latency (16.8s → <10s)
- [ ] Optimize intent analysis prompt
- [ ] Implement embedding caching
- [ ] Reduce top-K for faster retrieval

### 3. Future Enhancements
- [ ] Query decomposition for complex queries
- [ ] HyDE (Hypothetical Document Embeddings)
- [ ] Structured data retrieval for financial tables

## 📝 Blog Post Data Export

For blog posts documenting improvements, use:

```bash
node scripts/generate-eval-report.js --format=json
```

This generates `docs/evaluations/evaluation-data.json` with:
- Strategy timeline
- Metrics evolution
- Configuration changes
- Delta calculations

---

*Last updated: December 2024*

