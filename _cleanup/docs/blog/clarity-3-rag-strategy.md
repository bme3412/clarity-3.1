# Clarity 3.0 RAG Strategy (How Answers Are Built)

Clarity 3.0 is a Retrieval-Augmented Generation (RAG) app for **Big Tech earnings intelligence**. The system is designed to feel like a disciplined analyst: **retrieve first, then answer using only retrieved evidence**, and stream the result in real time.

This post explains the strategy in practical terms: what gets retrieved, how retrieval modes work, and how we keep responses grounded.

---

## The core idea: two data sources, one answer

Clarity pulls from two complementary sources:

1. **Structured financial JSON** (`data/financials/`)
   - Best for *exact numbers*: revenue, margins, EPS, segment revenue (when available).
   - Deterministic retrieval = fewer hallucinations for quantitative questions.

2. **Earnings call transcripts** (embedded into Pinecone)
   - Best for *qualitative context*: strategy, competition, product plans, guidance commentary.
   - Retrieved as chunks with metadata (ticker, fiscal year, quarter, source file).

The answer is assembled from whichever source(s) match the question.

---

## What happens when you ask a question

At a high level:

1. **Validate the request**
   - Input size limits + schema validation.

2. **Classify the question**
   - Is it asking for numbers (revenue, margin, EPS)?
   - Is it asking for narrative (strategy, risks, partnerships)?
   - Is there an implied timeframe (Q3 2024, FY2025, “latest”)?
   - Which ticker(s) are mentioned or implied?

3. **Retrieve evidence**
   - Structured metrics lookup for numeric queries.
   - Transcript search for narrative queries.
   - Sometimes both (e.g., “Explain the revenue driver behind growth”).

4. **Generate with grounding rules**
   - If the evidence doesn’t contain a fact/number, the answer should say **“Not found in provided sources.”**

5. **Stream the result**
   - The UI receives progress/status, tool events, and tokens as they’re generated.

---

## Retrieval modes (why they exist)

Clarity supports multiple retrieval “modes” because no single search strategy is best for every question.

### Smart Mode (auto)
Use when you’re not sure. The system routes the query to the most appropriate strategy based on intent.

### Precision (hybrid keyword + semantic)
Use when you care about **exact terms**:
- Quarters/years: “Q3 2024”, “FY2025”
- Product names: “Blackwell”, “MI300”
- Specific metrics: “gross margin”, “operating income”

This mode benefits from both semantic matching and keyword sensitivity.

### Concepts (dense-only semantic)
Use for broad, thematic questions:
- “What’s NVIDIA’s AI strategy?”
- “How is Google monetizing AI?”
- “What are the biggest risks called out by management?”

Dense embeddings tend to retrieve more relevant “strategy” text even when vocabulary differs.

### Exploratory (HyDE)
Use when your query is vague:
- “What’s driving growth?”
- “Any concerns?”

HyDE generates a short hypothetical answer/document first, then retrieves based on that text to find better context.

### Deep Dive (multi-query + fusion)
Use for multi-part questions:
- “Compare revenue growth and margins across segments”
- “Summarize strategy + risks + guidance changes”

The system expands into multiple sub-queries and fuses results to improve coverage.

---

## The grounding rule: no evidence, no claim

This is the most important trust mechanism in the app:

- **Every number must come from retrieved tool output.**
- If something isn’t in retrieved sources, the model should explicitly say it’s not found.

This makes the system robust to:
- Missing coverage for a quarter/year
- Ambiguous user queries
- Data schema drift

---

## Practical tips to get the best answers

If you want **numbers**, include:
- A ticker (e.g., AAPL)
- A timeframe (e.g., Q3 2024, FY2025, or “latest”)
- The metric (e.g., revenue, gross margin)

If you want **strategy**, include:
- A ticker
- A topic focus (AI strategy, pricing, competition, supply constraints)
- Optional: the timeframe (“since FY2023”, “in the latest call”)

---

## Summary

Clarity 3.0’s RAG strategy is intentionally simple:

- Use **structured data for quantitative questions**
- Use **transcript retrieval for qualitative questions**
- Use multiple retrieval modes to match query type
- Enforce grounding so the model stays honest when data is missing

If you want to explore the strategy evolution and experiments, check the RAG strategy page in the app.


