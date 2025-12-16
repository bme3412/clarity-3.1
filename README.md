# Clarity 3.0 – Financial Intelligence

A production-grade RAG system for financial analysis, demonstrating advanced retrieval, agentic tool use, and streaming LLM integration.

![Voyage AI](https://img.shields.io/badge/Embeddings-Voyage_3.5-0066FF?style=flat-square)
![Pinecone](https://img.shields.io/badge/Vector_DB-Pinecone-00A98F?style=flat-square)
![Claude](https://img.shields.io/badge/LLM-Claude_Opus_4-7C3AED?style=flat-square)
![Next.js](https://img.shields.io/badge/Framework-Next.js_15-000000?style=flat-square)

**Live demo:** https://bme-clarity-3.vercel.app/

---

## 🎯 What This Demonstrates

| Skill Area | Implementation |
|------------|----------------|
| **RAG Architecture** | Hybrid search (dense + sparse), chunking with overlap, metadata filtering |
| **Agentic LLM** | Claude tool use with structured financial tools |
| **Production Patterns** | Streaming SSE, error handling, rate limiting, observability |
| **Domain Expertise** | Financial data modeling, earnings transcript parsing |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLARITY 3.0 ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  User Query  │
    │  "AMD's AI   │
    │   strategy"  │
    └──────┬───────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS API LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    /api/chat/stream (SSE)                            │   │
│  │  • Request validation (Zod schemas)                                  │   │
│  │  • Streaming response controller                                     │   │
│  │  • Tool execution orchestration                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLAUDE OPUS (Agentic Layer)                          │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │ get_financial_   │    │ search_earnings_ │    │ compute_growth_  │      │
│  │    metrics       │    │   transcript     │    │     rate         │      │
│  │                  │    │                  │    │                  │      │
│  │  Structured JSON │    │  Semantic search │    │  YoY/QoQ delta   │      │
│  │  quarterly data  │    │  over transcripts│    │  calculations    │      │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘      │
│           │                       │                       │                 │
└───────────┼───────────────────────┼───────────────────────┼─────────────────┘
            │                       │                       │
            ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────────────────────────┐
│   LOCAL FINANCIALS  │  │           PINECONE VECTOR DB            │
│                     │  │                                         │
│  data/financials/   │  │  ┌─────────────────────────────────┐   │
│  ├── AAPL/          │  │  │      11,929 vectors             │   │
│  │   └── FY_2025/   │  │  │                                 │   │
│  │       └── Q3/    │  │  │  ┌───────────┐ ┌───────────┐   │   │
│  ├── AMD/           │  │  │  │  Dense    │ │  Sparse   │   │   │
│  ├── NVDA/          │  │  │  │  Voyage   │ │  BM25     │   │   │
│  └── ...            │  │  │  │  1024-dim │ │  Keywords │   │   │
│                     │  │  │  └───────────┘ └───────────┘   │   │
│  • Revenue, EPS     │  │  │                                 │   │
│  • Margins, FCF     │  │  │  Hybrid Search = Dense + Sparse │   │
│  • Segment data     │  │  └─────────────────────────────────┘   │
└─────────────────────┘  └─────────────────────────────────────────┘
            │                       │
            └───────────┬───────────┘
                        │
                        ▼
           ┌─────────────────────────┐
           │   CONTEXT ASSEMBLY      │
           │                         │
           │  • Retrieved chunks     │
           │  • Financial metrics    │
           │  • Metadata (FY, Q)     │
           └───────────┬─────────────┘
                       │
                       ▼
           ┌─────────────────────────┐
           │   STREAMING RESPONSE    │
           │                         │
           │  ──────────────────▶    │
           │  Token-by-token SSE     │
           │  + Citations            │
           │  + Metrics              │
           └─────────────────────────┘
```

---

## 🔧 Key Technical Decisions

### Why Voyage AI for dense embeddings?
Voyage `voyage-3.5` achieves **higher retrieval accuracy** on domain-specific text. In our testing on financial transcripts it delivered a ~5% lift on precision@10 versus the legacy baseline.

### Why Hybrid Search (Dense + Sparse)?
Dense embeddings excel at semantic similarity ("AI strategy" ≈ "machine learning initiatives"), but miss exact matches. BM25 sparse vectors catch specific terms like:
- Product names: "MI300", "Blackwell", "EPYC"  
- Financial terms: "gross margin", "Q3 FY2025"
- Ticker symbols: "NVDA", "AMD"

**Result:** Hybrid search combines the best of both—semantic understanding AND keyword precision.

### Chunking Strategy
```
┌─────────────────────────────────────────────────────────┐
│  800 chars │◀──150 overlap──▶│ 800 chars │◀──150...    │
└─────────────────────────────────────────────────────────┘
```
- **800 char chunks**: Small enough for precise retrieval, large enough for context
- **150 char overlap**: Preserves meaning across chunk boundaries (important for Q&A speaker transitions)

### Agentic Tool Use
Claude dynamically selects tools based on query type:

| Query Type | Tool Selected | Data Source |
|------------|---------------|-------------|
| "What was revenue?" | `get_financial_metrics` | Structured JSON |
| "AI strategy?" | `search_earnings_transcript` | Pinecone vectors |
| "YoY growth?" | `compute_growth_rate` | Calculated |

---

## 📊 Data Coverage

| Metric | Value |
|--------|-------|
| **Tickers** | 10 (AAPL, AMD, AMZN, AVGO, CRM, GOOGL, META, MSFT, NVDA, ORCL) |
| **Years** | FY2020 – FY2025 |
| **Total Vectors** | 11,929 |
| **Transcript Files** | 571 |
| **Structured Financials** | Revenue, EPS, margins, FCF, segments |

---

## 🚀 Performance

| Metric | Target | Actual |
|--------|--------|--------|
| Time to First Token | <2s | ~1.5s |
| Full Response | <15s | ~8-12s |
| Retrieval Latency | <500ms | ~200-400ms |

---

## 📁 Project Structure

```
clarity-3.0/
├── src/
│   ├── app/
│   │   ├── api/chat/stream/     # Streaming chat endpoint
│   │   ├── components/          # React components
│   │   └── lib/llm/             # Claude & Voyage clients
│   └── lib/
│       ├── rag/                 # RAG pipeline components
│       │   ├── retriever.js     # Hybrid search
│       │   ├── sparseVectorizer.js
│       │   └── components.js    # Embedder, Analyzer
│       ├── tools/               # Claude tool definitions
│       ├── prompts/             # System prompts
│       └── data/                # Financial data loaders
├── data/
│   ├── financials/              # Structured JSON (by ticker/FY/Q)
│   └── transcripts/             # Earnings call transcripts
├── public/                      # Static assets served by Next.js
└── _cleanup/                    # Non-core dev artifacts (kept out of repo root)
    ├── docs/                    # Moved documentation + blog drafts
    ├── scripts/                 # Embedding + evaluation + maintenance scripts
    ├── evals/
    │   ├── evaluation_report.json
    │   └── evaluation_reports/  # Per-case eval artifacts
    └── dev-artifacts/           # Logs, scratch outputs
```

---



## ✨ Features

- **Natural-language workflows** – ask "Compare Apple and Microsoft AI capex in FY24" and get a tailored answer with citations
- **True streaming UX** – Claude responses stream token-by-token over SSE
- **Structured financial intelligence** – JSON filings rendered as tables or charts
- **Coverage-aware retrieval** – Metadata filters for ticker, fiscal year, quarter
- **Real-time metrics** – See retrieval latency, token usage, and source scores

---

## 📈 Evaluation

The system includes an evaluation framework comparing RAG strategies:

| Strategy | Faithfulness | Relevance | Notes |
|----------|-------------|-----------|-------|
| Dense Only | 0.78 | 0.82 | Good semantic matching |
| Hybrid (Dense + BM25) | 0.85 | 0.88 | Better keyword recall |
| HyDE | 0.81 | 0.84 | Helps vague queries |
| Multi-Query | 0.83 | 0.86 | Broader coverage |

---

## 🔗 Related

- [Voyage AI](https://www.voyageai.com/) – Embedding provider
- [Pinecone](https://www.pinecone.io/) – Vector database
- [Anthropic Claude](https://www.anthropic.com/) – LLM with tool use
- [Langfuse](https://langfuse.com/) – Observability (optional)

---

