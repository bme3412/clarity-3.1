# Clarity 3.0 – Financial Intelligence

A Next.js 15 research experience that lets analysts write intelligent queries for 240 Big Tech earnings calls, transcripts, and structured financial statements with natural language questions and sub-20-second streaming answers.

**Live demo:** https://bme-investment-copilot-vectorDB.vercel.app/

---

## Overview

Clarity 3.0 combines a polished React front end with a Retrieval-Augmented Generation (RAG) stack powered by Anthropic Claude, Voyage embeddings, Pinecone, and locally curated JSON financials. Analysts can launch a chat session with prefilled prompts, watch the model stream its reasoning in real time, and drill into structured tables or follow-up ideas without leaving the conversation.

The repository ships with 10 Big Tech tickers (AAPL, AMD, AMZN, AVGO, CRM, GOOGL, META, MSFT, NVDA, ORCL), five+ years of quarterly data (through FY2025), and automation scripts for refreshing embeddings or ingesting new transcripts.

---

## Why analysts use Clarity 3.0

- **Natural-language workflows** – ask “Compare Apple and Microsoft AI capex in FY24” and get a tailored answer with citations, follow-ups, and optional tabular drills.
- **True streaming UX** – Claude responses, metadata, error states, and suggested follow-ups flow over server-sent events so the UI can paint progress immediately.
- **Structured financial intelligence** – JSON filings in `data/financials` are normalized, cached, and rendered as detailed tables or charts directly in the chat context.
- **Coverage-aware retrieval** – Voyage embeddings and Pinecone metadata filters understand timeframes, tickers, and content types for precise recall across thousands of chunks.
- **Design-first product surface** – polished landing page, persistent chat layout, hovering help tips, and animated metric cards keep analysts oriented.

---

## System architecture & request flow

1. **Intent classification** – Claude-based `QueryIntentAnalyzer` tags the ask as financial/market/strategy, extracts tickers, and normalizes timeframes.
2. **Embedding & retrieval** – Voyage `voyage-3.5` produces query embeddings, Pinecone filters by ticker, fiscal year, quarter, and content type, and results are rescored for relevance.
3. **Structured data enrichment** – `FinancialJSONRetriever` and `financialDataCache` load quarterly JSONs from `data/financials/<TICKER>/FY_<YEAR>/QX`.
4. **Claude reasoning** – `EnhancedFinancialAnalyst` or the streaming pipeline formats the retrieved snippets plus local metrics into a focused system prompt and streams the answer.
5. **SSE transport** – `/api/chat/financial` and `/api/chat/stream` stream metadata, content deltas, follow-up questions, and termination signals down to the browser.

---

## Front-end experience

- **Landing page (`src/app/components/Landing.js`)** – hero copy, animated gradients, sample query chips that deep-link into `/chat`.
- **Chat interface (`Chatbox.js`)** – maintains conversation history, progress stages, streaming updates, follow-up triggers, and “Reset Terminal” UX.
- **Visualization primitives (`Display.js`, `FinancialChart.js`, `StructuredFinancialTable.js`)** – recharts-powered metric cards, cash-flow charts, tables tied to `/api/chat/financial-table`.
- **Help & onboarding (`HelpTips.js`, `WelcomeGuide.js`, `Companies.js`)** – embedded documentation describing the pipeline and showing code snippets.

---

