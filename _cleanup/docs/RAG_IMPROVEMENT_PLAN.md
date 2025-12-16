# Professional Enterprise-Grade RAG Improvement Plan

This document outlines a comprehensive strategy to elevate the current RAG application to an enterprise-grade standard. The focus is on increasing retrieval accuracy, ensuring system reliability through evaluations, and enabling deep observability.

## Phase 1: RAG Effectiveness & Retrieval Architecture

The current implementation relies on simple dense vector retrieval (Voyage + Pinecone) and basic metadata filtering. To handle complex financial queries, we need a more robust pipeline.

### 1. Hybrid Search (Semantic + Keyword)
**Problem:** Vector search often misses exact matches for specific financial terms (e.g., "EBITDA", specific ticker symbols, exact revenue figures) because they might not be semantically "close" in the vector space.
**Solution:** Implement Hybrid Search.
-   **Implementation:** Use Pinecone's hybrid search capabilities (sparse-dense vectors).
-   **Tech:** Generate sparse vectors (e.g., using BM25 or SPLADE) alongside dense Voyage embeddings.
-   **Benefit:** Captures both conceptual similarity and exact keyword matches, crucial for financial data.

### 2. Advanced Reranking
**Problem:** Vector databases return "approximate" nearest neighbors. The top 10 results might contain irrelevant noise that confuses the LLM.
**Solution:** Add a Cross-Encoder Reranker step after retrieval.
-   **Implementation:** Retrieve a larger set of candidates (e.g., Top 50) -> Pass to Reranker -> Return Top 5-10 to LLM.
-   **Tech:** Cohere Rerank (API) or `bge-reranker-v2-m3` (local/hosted).
-   **Benefit:** drastically improves precision by assessing the actual relevance of the document-query pair.

### 3. Query Decomposition & Expansion
**Problem:** Complex queries like "Compare NVDA and AMD margins over the last 3 years" fail because single-shot retrieval can't target multiple distinct entities and timeframes effectively.
**Solution:** Implement a Query Transformation layer.
-   **Decomposition:** Break complex questions into sub-queries:
    1. "Get NVDA margins 2021-2024"
    2. "Get AMD margins 2021-2024"
    3. Synthesize answer.
-   **HyDE (Hypothetical Document Embeddings):** For abstract strategy questions, generate a hypothetical answer first, then embed that to find similar real documents.

### 4. Hierarchical / Parent-Child Chunking
**Problem:** Financial documents (10-Ks, transcripts) are long. Standard chunking splits context (e.g., a table header from its rows).
**Solution:** Store small chunks for retrieval but retrieve the "Parent" document (or larger window) for the LLM.
-   **Implementation:** Index 200-token chunks. When a chunk is matched, fetch the surrounding 800-1000 token window (or full section).
-   **Benefit:** Preserves context (like "which year is this number from?") that is often lost in small chunks.

---

## Phase 2: Evaluation & Testing (Evals)

Currently, `evaluate-rag.js` is basic. We need a systematic, metric-driven approach.

### 1. Framework Integration
Adopt a dedicated RAG evaluation framework.
-   **Tools:** **DeepEval** or **Ragas** (Python-based, but can be integrated or run alongside).
-   **Key Metrics:**
    -   **Faithfulness:** Does the answer hallucinate info not in the context?
    -   **Answer Relevance:** Does the answer actually address the user's prompt?
    -   **Context Precision:** Is the relevant chunk ranked at the top?
    -   **Context Recall:** Did we retrieve all necessary information?

### 2. "Golden" Dataset Creation
Move away from ad-hoc testing to a curated "Golden Dataset" of QA pairs.
-   **Structure:** `{ question, ground_truth_answer, expected_context_ids }`
-   **Generation:** Use an LLM to generate synthetic QA pairs from your financial documents to bootstrap coverage.

### 3. CI/CD Integration
-   Run a subset of evals (e.g., "Smoke Test" of 20 critical questions) on every Pull Request.
-   Fail builds if "Faithfulness" or "Relevance" drops below a threshold (e.g., 0.8).

---

## Phase 3: Observability (Logs & Tracing)

"Console.log" is insufficient for debugging complex RAG chains.

### 1. Tracing Platform
Integrate an LLM observability platform.
-   **Tools:** **LangSmith**, **Arize Phoenix**, or **Helicone**.
-   **What to Trace:**
    -   **Inputs:** User query, filters applied.
    -   **Retrieval:** Exact chunks returned, their scores, and metadata.
    -   **LLM:** Full system prompt, user prompt, raw output, token usage, latency.
-   **Benefit:** When an answer is wrong, you can immediately see *why* (e.g., "The retriever found the 2022 document instead of 2024").

### 2. Feedback Loops
-   Add "Thumbs Up / Thumbs Down" in the UI.
-   Log this feedback to the tracing platform.
-   Use negative feedback to identify "hard" queries and add them to the Golden Dataset.

---

## Phase 4: Engineering & Production Readiness

### 1. Streaming Responses
**Current:** The API waits for the full generation before responding.
**Fix:** Implement `StreamingTextResponse` (using Vercel AI SDK or standard SSE) to stream tokens to the frontend immediately. Drastically improves perceived latency.

### 2. TypeScript Migration
Migrate from vanilla JavaScript to **TypeScript**.
-   **Why:** Complex data structures (RAG results, financial metadata) are error-prone in JS. TS ensures type safety for `metadata` fields, preventing "undefined" errors at runtime.

### 3. Structured Data Handling
Financial data is often tabular.
-   **Parser:** Use LLMs or specialized parsers (like LlamaParse) to convert PDF tables into Markdown or JSON before embedding.
-   **Retriever:** Allow the LLM to query structured data (SQL/JSON) alongside text (Vector) for questions like "What was the exact revenue in Q3?".

## Summary of Next Steps

1.  **Immediate:** Implement **Streaming** and **Reranking** (low effort, high impact).
2.  **Short Term:** Set up **LangSmith/Phoenix** for tracing and build a **Golden Dataset**.
3.  **Medium Term:** Implement **Hybrid Search** and **Parent-Child Chunking**.
4.  **Long Term:** Migrate to **TypeScript** and automated CI/CD evals.

