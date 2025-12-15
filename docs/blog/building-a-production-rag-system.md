# Building Production-Grade RAG in Clarity 3.0

**The engineering decisions that moved accuracy, faithfulness, and latency in a financial-intelligence RAG system**

*10 min read · RAG · Evaluation · Hybrid Search · Latency · Grounding*

---

Clarity 3.0 is a financial-intelligence RAG system 
This post is about the engineering decisions that made Clarity feel production-grade: fewer hallucinations, faster responses, and better transparency. Not based on vibes, but grounded in an evaluation loop.

## TL;DR

- **Treat faithfulness as the north star** — if retrieval is wrong, the model is forced to guess
- **Split evidence into two lanes** — structured financial JSON for numbers + transcript chunks for narrative
- **Hybrid retrieval matters for exactness** — quarters, tickers, metric terms, product names
- **Latency is two projects** — real speed (TTFT/total time) and perceived speed (streaming + observability)

## Current Performance

**Latest evaluation run** (December 10, 2025):

| Metric | Score |
|--------|-------|
| Relevance | 82.1% |
| Faithfulness | 89.5% |
| Accuracy | 79.5% |
| Avg Latency | 8.8s |

This represents significant improvement from the baseline documented in early iterations:

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| Relevance | 77.3% | 82.1% | +4.8pp |
| Faithfulness | 77.0% | 89.5% | +12.5pp |
| Accuracy | 65.0% | 79.5% | +14.5pp |
| Latency | 19.5s | 8.8s | 55% faster |

But the numbers alone don't tell the story. The real wins came from understanding *which questions fail and why*.

## What "Production-Grade" Meant for This Project

For Clarity, "production-grade" wasn't about deployment scale. It meant:

1. **Measurable quality** — relevance, faithfulness, accuracy scored on a golden dataset
2. **Measurable performance** — time-to-first-token (TTFT) + total latency tracked per query
3. **Operational trust** — show what was retrieved, which tools ran, and why the system is confident

The key realization: **RAG quality is mostly decided before the model starts generating.** If retrieval is wrong, prompting can't save you.

## The Evaluation Loop (The Thing That Made Progress Real)

Early on, I kept "fixing" the system and then arguing with myself about whether it got better. The fix was boring but decisive:

- A golden dataset of 21 questions + ground truth (`data/evaluation/dataset.json`)
- Repeatable runs that store artifacts in `evaluation_reports/<strategy>/<run_id>/`
- A summary snapshot (`evaluation_report.json`) for quick comparisons
- Strategy versioning so changes are testable and reversible

Looking at the current eval breakdown by category:

- **Unanswerable queries** (10/21) — mostly 80-100% accuracy, properly refusing to hallucinate
- **Financial queries** (3/21) — 85-100% accuracy when data exists
- **Strategy queries** (3/21) — 75-100% accuracy on narrative questions
- **Market/comparison** (3/21) — 30-60% accuracy, still the weakest category
- **Executive/guidance** (2/21) — 20-60% accuracy, needs improvement

**Why this matters:** Without a fixed dataset and repeatable runs, "improvements" are just anecdotes. The eval dashboard became the single source of truth.

## Baseline Failure Modes (And Why Prompting Didn't Save It)

The early evaluation exposed a pattern in failures:

### Wrong Content Type Retrieved

Strategic questions like "What did AMD's CEO say about AI demand?" pulled financial context, and the model "filled in" missing narrative → faithfulness collapsed to 60%.

### Coverage Gaps

Missing embeddings meant some companies returned zero semantic matches → accuracy dropped below 50% on those queries.

### Exactness Failures

Dense embeddings are great at meaning, terrible at "Q3 FY2025" vs "Q2 FY2025." Questions like "What was AMD's total revenue in Q3 2024?" would retrieve Q2 data and confidently report wrong numbers.

### Fiscal Calendar Traps

"Latest quarter" isn't universal across companies. Asking "Compare NVDA vs AMD latest quarter" could silently answer with stale quarters for one company.

**Diagnosis:** Retrieval—not prompting—was the bottleneck.

## Decision #1: Two Evidence Lanes (Numbers vs Narrative)

Clarity ended up with a simple rule: **use the best source for the type of claim**.

### Lane A — Structured Financial JSON for Numbers

- **Source:** `data/financials/`
- **Best for:** revenue, margins, EPS, cash flow, segment metrics
- **Property:** deterministic retrieval (less hallucination pressure)

### Lane B — Transcript Retrieval for Narrative

- **Source:** embedded transcript chunks (with ticker/year/quarter metadata)
- **Best for:** strategy, risks, guidance commentary, competitive positioning

**Trade-off:** Two retrieval paths and two schemas to maintain.

**Payoff:** Numbers stop being "best guesses," and qualitative answers become auditable.

**Evidence from evals:** Financial queries now achieve 85-100% accuracy when the data exists in the structured lane. Before this split, the system would try to extract numbers from transcript text, leading to extraction errors and hallucinations.

## Decision #2: Hybrid Retrieval (Dense + Sparse) to Fix Keyword Blindness

Dense embeddings answer: *"What does this mean?"*

Finance questions often require: *"Where is this exact string?"*

So hybrid became non-optional:

- **Dense vectors** for semantic understanding ("How is Meta investing in AI infrastructure?")
- **Sparse/BM25-style** for exact matching ("Q3 2024," "MI325X," "Data Center segment")
- **Blended scoring** in Pinecone

The core lesson:

- Hybrid helps where you expect (exact numbers/exact terms)
- Dense still wins many conceptual queries
- **Coverage parity matters more than the algorithm** — a smaller index loses even if retrieval is "better"

**Trade-off:** Index migration and re-embedding work.

**Payoff:** Better recall for exact terms, and in practice, hybrid can be faster at retrieval.

**Evidence from evals:** Questions with exact terms like "What was AMD's total revenue in Q3 2024?" now score 100% relevance and 85% faithfulness. Before hybrid, these would often retrieve adjacent quarters or miss entirely.

## Decision #3: Fiscal-Year Intelligence ("Latest" Must Mean Latest Per Company)

Financial apps have a hidden landmine: fiscal calendars differ. If you treat "latest" as a single global period, cross-company comparisons silently go wrong.

Clarity introduced `fiscalYear: "latest"` so "latest" resolves per ticker.

**Trade-off:** Extra lookup/caching complexity.

**Payoff:** Eliminates a class of silent wrong-quarter answers.

**Evidence from evals:** Before this, comparison questions like "Compare NVDA vs AMD latest quarter" scored 30% accuracy because one company would be months behind. Still a weak point in current evals, but at least now the system *knows* when quarters don't align.

## Decision #4: Schema Hardening for Real-World Financial JSON

Even "structured" data is messy. Margin fields appear under different paths depending on company/source/version.

Clarity moved to explicit fallback chains so metrics like gross margin are consistently found.

**Trade-off:** More code paths to maintain.

**Payoff:** Fewer false "not found" responses and fewer brittle failures as schemas drift.

## Decision #5: Latency Was Two Separate Projects

### Part A — Real Latency Improvements

Documented improvements:

- **TTFT:** 22.8s → 16.5s (28% faster) → now typically sub-10s
- **Total time:** 30.0s → 20.9s (30% faster) → now averaging 8.8s
- **Retrieval:** 1.7s → 0.98s (42% faster)

These came from pragmatic choices:

- **Model selection** that matched the use case (interactive analysis favors lower TTFT)
- **Less wasted work** (query routing, fewer unnecessary tool loops)
- **Faster retrieval paths** (hybrid, narrower candidate sets)

### Part B — Perceived Latency and Trust (Observability)

Users don't just care about latency—they care about *what's happening* during the wait.

So Clarity added:

- **Pipeline stages** ("analyzing," "searching," "generating")
- **Tool start/result events** (which tools ran, what they returned)
- **Behind-the-scenes panel** (retrieved chunks, tool inputs/outputs, config)
- **Lightweight metrics** (TTFT, total time, chunk counts, average relevance score)

**Trade-off:** More UI state complexity and more streamed payload.

**Payoff:** Less abandonment, easier debugging, and more trust.

**Evidence from evals:** Latency is now consistent across query types. Financial queries (10-12s) are slightly slower than unanswerable queries (5-7s) due to structured data lookups, which is acceptable given the accuracy gains.

## Decision #6: Retrieval Modes Instead of One-Size-Fits-All

No single retrieval strategy is best for every question, so Clarity supports multiple modes:

- **Precision/hybrid** for exact terms (quarters, tickers, products, metric names)
- **Concept/dense** for thematic questions ("AI strategy," "monetization")
- **Deep-dive patterns** for multi-part questions (multi-query + fusion)

**Trade-off:** More branching, more strategy configs to evaluate.

**Payoff:** Each query type gets a strategy designed for its failure mode.

**Evidence from evals:** Strategy questions ("What is Apple's approach to AI and machine learning?") now score 95% relevance and 95% faithfulness using concept/dense. Executive quotes ("What did AMD's CEO say...") still struggle at 60% relevance because they need better speaker attribution in chunks.

## The Meta-Trade-off: Flexibility vs Simplicity

Clarity consistently chose optionality over hard commitments:

- Strategies are versioned and comparable
- Model selection is environment-configurable
- Retrieval is routed by query type instead of "one best method"

**Trade-off:** More moving parts.

**Payoff:** Safer iteration, fewer regressions, and easier explanations when something changes.

## Current Strengths and Weaknesses (From the Evals)

### What Works Well (80%+ scores)

1. **Unanswerable queries** — system properly refuses to hallucinate when data doesn't exist
2. **Financial fundamentals** — revenue, margins, segment performance when data is indexed
3. **Strategy/infrastructure** — narrative questions about company approaches and investments

### What Still Needs Work (< 70% scores)

1. **Executive attribution** — "What did [CEO] say about X?" struggles with speaker-level retrieval (60% relevance)
2. **Cross-company comparisons** — fiscal calendar misalignment still causes issues (30-40% accuracy)
3. **Guidance questions** — forward-looking statements need better chunk boundaries (60% accuracy)

### Interesting Edge Cases

- **"How did the AMD Data Center segment perform in Q3 2024?"** — 95% relevance/faithfulness but only 20% accuracy. The system found the right context but extracted wrong numbers. This points to extraction logic issues, not retrieval.

- **"How is the cloud computing market affecting Microsoft's business?"** — 85% on all metrics. Market context questions work when they're about indexed companies, but struggle when they require general market knowledge.

## Key Lessons (What Actually Mattered)

### 1. Retrieval > Prompting

Most answer quality is determined before the LLM sees anything. Think of the model as a brilliant analyst who can only work with documents on their desk—your job is putting the right documents there.

**Proof point:** The 12.5pp improvement in faithfulness came almost entirely from better retrieval (two-lane split + hybrid), not from prompt engineering.

### 2. Measure Everything (Separately)

Every hour spent on evaluation infrastructure saves multiple hours of "mysterious quality" debugging. You need faithfulness AND accuracy measured separately—they fail in different ways.

**Proof point:** High faithfulness (89.5%) with lower accuracy (79.5%) tells you the system is grounded but sometimes retrieves wrong context. This is fixable. High accuracy with low faithfulness would mean lucky guessing—much harder to fix.

### 3. Coverage > Cleverness

The best retrieval algorithm can't retrieve data that isn't embedded or indexed. Before debating dense vs hybrid vs rerankers, ensure coverage parity.

**Proof point:** Several 20-30% accuracy scores in comparisons trace back to missing earnings calls or incomplete indexing, not algorithmic failures.

### 4. Latency is Two Projects

Real latency is compute and routing (8.8s average). Perceived latency is transparency (streaming status, tool traces, metrics). You need both for an interactive product.

**Proof point:** Users tolerate 10-12s waits for complex financial queries when they can see "Analyzing financial data for AMD Q3 2024..." vs immediately giving up on a blank screen.

### 5. Grounding is a Product Feature

A finance tool must prefer "Not found in provided sources" over confident guesses. Users forgive missing data; they don't forgive fake certainty.

**Proof point:** All 10 unanswerable queries score 70-100% accuracy by properly refusing to answer. This is a feature, not a bug.

## What's Next (Based on Evals, Not Guessing)

The current evaluation clearly points toward:

1. **Increase embedding coverage** — several accuracy failures trace to missing companies or periods
2. **Better executive/speaker attribution** — chunk metadata needs speaker labels for "CEO said" queries
3. **Reranking for comparisons** — cross-company queries need better relevance scoring
4. **Smarter guidance chunking** — forward-looking statements span multiple paragraphs poorly

## Closing Thought

The lesson from Clarity 3.0 isn't "hybrid search is best" or "use model X."

It's this: **RAG is systems engineering.**

Quality comes from coverage, retrieval, grounding rules, and evaluation discipline. Once those are strong, the model gets to be what it should be: a synthesis engine—not a guesser.

The jump from 65% to 79.5% accuracy, and 77% to 89.5% faithfulness didn't come from better prompts. It came from better infrastructure.

---

*Clarity 3.0 is an open-source financial RAG system. Evaluation framework and metrics available at [repository link].*