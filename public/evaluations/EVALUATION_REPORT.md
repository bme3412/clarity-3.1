# Clarity RAG Evaluation Report

> Generated: 2025-12-04T20:30:13.471Z

This report tracks the evolution of our RAG (Retrieval-Augmented Generation) system for financial analysis. Each strategy version represents improvements to embedding, retrieval, or synthesis components.

## 📊 Executive Summary

**Current Strategy:** baseline (v1.0)

| Metric | Score |
|--------|-------|
| Relevance | 84.5% |
| Faithfulness | 74.5% |
| Accuracy | 89.1% |
| Avg Latency | 16516ms |

## 🔄 Strategy Evolution

### v1.0: baseline

**Created:** 2024-12-03 | **Status:** active

Initial RAG implementation using Voyage 3.5 embeddings with Pinecone vector search. Baseline for measuring future improvements.

<details>
<summary>📋 Configuration Details</summary>

**Embedding:**
- Model: `voyage-3.5`
- Dimensions: 1024
- Provider: Voyage AI

**Retrieval:**
- Vector DB: Pinecone
- Search Type: dense
- Top-K: 12
- Reranking: none

**Chunking:**
- Strategy: semantic
- Chunk Size: 1500
- Overlap: 200

</details>

**Evaluation Results:**

| Metric | Score | vs Previous |
|--------|-------|-------------|
| Relevance | 84.5% |  |
| Faithfulness | 74.5% |  |
| Accuracy | 89.1% |  |

**Known Limitations:**
- Vector search may miss exact financial terms (e.g., specific revenue figures)
- No cross-encoder reranking - top results may include noise
- Complex multi-entity queries (comparisons) not well optimized
- No parent-child chunking - context can be fragmented

---

## 📖 Metrics Definitions

| Metric | Description | Range |
|--------|-------------|-------|
| **Relevance** | Does the answer address the user's question? | 0-100% |
| **Faithfulness** | Is the answer grounded in retrieved context? | 0-100% |
| **Accuracy** | Does the answer match ground truth facts? | 0-100% |
| **Latency** | End-to-end response time | ms |

## 📝 Evaluation Dataset

The evaluation uses 11 test cases across categories:

| Category | Count |
|----------|-------|
| financial | 3 |
| strategy | 3 |
| comparison | 1 |
| market | 2 |
| executive | 1 |
| guidance | 1 |

