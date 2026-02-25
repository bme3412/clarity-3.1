## Quick Cleanup Audit

### 1) Dead Code (likely safe to remove)
- `src/app/api/chat/stream/route.js` (entire file, esp. intent analyzer at 74-132 and handler at 791-1019): no front-end fetches to `/api/chat/stream` (`grep` shows only the route file itself).  
- `src/app/api/chat/route.js` (21-96): legacy non-streaming pipeline; front-end uses `/api/chat/financial` instead.  
- `src/app/api/chat/FinancialJSONRetriever.js` (entire file): class is defined but never imported anywhere.  
- `src/utils/requestDeduplication.js` (1-78): exported singleton is never imported; deduplication is unused.  

### 2) Duplicate Logic (consolidation candidates)
- Query intent classification appears twice with near-identical prompts: `src/lib/rag/components.js` (677-735) and `src/app/api/chat/stream/route.js` (74-132).  
- Company alias/ticker detection implemented separately: `src/config/rag.js` (24-48) and `src/app/api/chat/stream/route.js` (16-40).  
- Hybrid rerank / sparse hybrid logic duplicated: `src/lib/rag/components.js` (277-315) vs `src/app/api/chat/financial/route.js` (109-142, 581-606).  
- Financial metric extraction duplicated: `src/utils/financialDataCache.js` (90-170) vs `src/app/api/chat/financial-table/route.js` (1298-1456).  
- Streaming answer prompting patterns partially duplicated between `src/app/api/chat/stream/route.js` (481-564) and `src/app/api/chat/financial/route.js` (671-706).  

### 3) Unclear Organization
- Two parallel RAG stacks live in different places (`src/lib/rag/*` vs `src/app/api/chat/financial/route.js`’s bespoke stack). Consider merging or clearly separating “baseline” vs “strategy” stacks.  
- LLM clients/prompts live under `src/app/lib/llm/*` while the main pipeline lives in `src/lib/rag/*`; this split makes ownership unclear.  
- `src/app/api/chat/financial-table/route.js` mixes parsing, business rules, fallback ASCII parsing, and response shaping in one 1.5k-line file—candidate to split into parsing vs formatting helpers.  

### 4) Inconsistencies
- Different error-handling patterns across chat routes:  
  - `src/app/api/chat/route.js` returns JSON `{analysis, metadata}` on 400/500 (63-105).  
  - `src/app/api/chat/financial/route.js` streams `data: {type:'error'}` SSE chunks (746-749).  
  - `src/app/api/chat/stream/route.js` emits SSE errors with user-facing strings (975-993).  
- Embedding providers vary by route: `chat/route.js` uses Voyage; `chat/financial` uses OpenAI embeddings + optional sparse; `stream` uses Voyage. No unified selection logic.  
- Timeframe filters use mixed metadata keys (`fiscal_year` vs `fiscalYear`) across retrievers (`src/lib/rag/pipeline.js` 83-188 vs `src/app/api/chat/financial/route.js` 470-627).  
- Prompt style guidelines differ (streaming prompt at 481-564 vs financial prompt at 671-706), leading to divergent tone/structure.  
- Naming drift: transcript types use `type`/`file_type`/`retrieval` inconsistently (`PineconeRetriever.normalizeMetadata` 354-370 vs financial route metadata 639-660).  

### Suggested Next Steps
- Remove or archive unused routes/classes (`/api/chat/stream`, legacy `/api/chat`, FinancialJSONRetriever duplicate, requestDeduplication).  
- Centralize intent analysis, company alias mapping, hybrid rerank, and financial metric extraction into shared helpers under `src/lib/rag`.  
- Clarify ownership: decide on a single pipeline entry (or clearly mark “baseline” vs “strategy”) and align embeds/retrieval filters.  
- Normalize metadata fields (`fiscalYear`, `quarter`, `type`) and error/streaming envelopes to one pattern.  
