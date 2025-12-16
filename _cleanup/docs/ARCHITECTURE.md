# System Architecture

## Overview

Next Copilot is a Retrieval-Augmented Generation (RAG) system specialized in financial data analysis. It combines vector similarity search with structured data retrieval to provide accurate answers about company financials, earnings calls, and strategic outlooks.

## Architecture Components

### 1. Data Pipeline (`/scripts`)

The data ingestion pipeline handles the transformation of raw financial transcripts and JSON data into vector embeddings.

**Workflow:**
1.  **Ingestion:** Reads raw JSON/Text files from `data/transcripts`.
2.  **Extraction:** specialized parsers (`extractFinancials`, `extractOutlook`) isolate key sections to ensure semantically relevant chunks.
3.  **Chunking:** Custom semantic chunking splits text while preserving sentence boundaries and context.
4.  **Embedding:** Text chunks are converted to vectors using **Voyage AI** (`voyage-3.5`).
5.  **Storage:** Vectors are upserted to **Pinecone** with rich metadata (Fiscal Year, Quarter, Section Type).

### 2. Retrieval Engine (`src/app/api/chat`)

The retrieval system employs a hybrid strategy to maximize accuracy:

*   **Query Intent Analysis:**
    *   Uses **Claude 3.5 Sonnet** to classify user intent (e.g., "Financial", "Strategic", "General").
    *   Extracts entities (Company Ticker) and Timeframes (e.g., "Q3 2024").
    
*   **Vector Retrieval (Pinecone):**
    *   Performs semantic search to find relevant qualitative context (e.g., CEO remarks, strategic initiatives).
    *   Applies metadata filters based on the detected timeframe and company.

*   **Structured Retrieval (FinancialJSONRetriever):**
    *   Acts as a fallback or enhancement for specific quantitative queries.
    *   Directly accesses structured financial JSON files for exact numbers (Revenue, EPS).

### 3. Generation Layer

*   **LLM:** **Anthropic Claude 3.5 Sonnet**.
*   **Context Window:** Constructs a prompt containing both the retrieved vector matches and structured financial data.
*   **System Prompting:** Enforces a "Financial Analyst" persona, ensuring professional, data-backed responses.

## Key Classes & Modules

| Class | Purpose | Location |
|-------|---------|----------|
| `VoyageEmbedder` | Handles interaction with Voyage AI API for embedding generation. | `src/app/api/chat/route.js` |
| `PineconeRetriever` | Manages vector search, filtering, and query preprocessing. | `src/app/api/chat/route.js` |
| `FinancialJSONRetriever` | deterministic retrieval of local JSON financial data. | `src/app/api/chat/FinancialJSONRetriever.js` |
| `QueryIntentAnalyzer` | Classifies user queries to optimize retrieval strategy. | `src/app/api/chat/route.js` |
| `EnhancedFinancialAnalyst` | The final synthesis layer that generates the answer. | `src/app/api/chat/route.js` |

## Data Flow Diagram

```mermaid
graph TD
    User[User Query] --> API[Next.js API Route]
    API --> Intent[Intent Analyzer (Claude)]
    
    Intent -->|Semantic Search| Vector[Pinecone Vector Store]
    Intent -->|Quantitative Data| JSON[Local JSON Store]
    
    Vector --> Context[Context Aggregator]
    JSON --> Context
    
    Context --> LLM[Claude 3.5 Sonnet]
    LLM --> Response[Final Answer]
```

## Future Improvements

- **Database Migration:** Move structured JSON data to a relational database (PostgreSQL) for production scalability.
- **Async Processing:** Implement a job queue for data ingestion to handle larger datasets.
- **Evaluation:** Add RAGAS or similar evaluation framework to measure retrieval accuracy.

