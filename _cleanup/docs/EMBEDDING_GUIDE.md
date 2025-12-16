# Clarity 3.0 - Embedding Guide

## Quick Start

### 1. Check Current Status
```bash
node scripts/embed-all-voyage.js --status
```

This shows:
- Total vectors in your Pinecone index
- Which tickers are indexed
- Which have FY2025 data locally but not indexed

### 2. Index FY2025 Data Only (Fastest)
```bash
node scripts/embed-all-voyage.js --2025
```

This adds just the FY2025 transcripts to your existing index (~15-20 min).

### 3. Full Re-index (Recommended for Best Results)
```bash
node scripts/embed-all-voyage.js --refresh
```

This deletes existing vectors and re-indexes everything with:
- Optimized chunking (800 chars with 150 char overlap)
- Better metadata (dual fiscalYear formats for compatibility)
- Sparse vectors for keyword matching
- All years including FY2025

**Estimated time**: ~45-60 minutes for all 10 tickers

### 4. Index Single Ticker
```bash
node scripts/embed-all-voyage.js AMD
node scripts/embed-all-voyage.js NVDA --refresh  # Delete & re-embed
```

---

## What Changed

### Embedding Strategy
| Before | After |
|--------|-------|
| Voyage 3.5 dense only | Voyage 3.5 + BM25 sparse hybrid |
| 1000 char chunks, no overlap | 800 char chunks with 150 overlap |
| Basic stopwords | Financial-domain optimized |
| No sparse on retrieval | Always tries hybrid search |

### Retrieval Improvements
- **Hybrid search**: Dense (semantic) + Sparse (keyword) for better recall
- **Financial term boosting**: Words like "revenue", "margin", "datacenter" get 50% weight boost
- **Year-priority search**: Tries FY2025 first, then FY2024, then all
- **Graceful fallback**: If sparse fails, automatically retries dense-only

---

## Configuration

Your `.env` should have:
```
VOYAGE_API_KEY=your_voyage_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=clarity-1024
```

Optional:
```
PINECONE_SUPPORTS_SPARSE=true  # Default: true
```

---

## Troubleshooting

### "Sparse vectors not supported"
Your Pinecone index may not support sparse vectors. Options:
1. Set `PINECONE_SUPPORTS_SPARSE=false` in `.env` (uses dense-only)
2. Create a new index with `dotproduct` metric for full hybrid support

### Slow embedding
- Voyage rate limit: ~300 requests/min
- Script uses 80ms delay = ~12 req/sec
- Full re-index: ~45-60 min for 10 tickers

### Missing FY2025 results
1. Run `node scripts/embed-all-voyage.js --status`
2. If FY2025 shows "0 vectors", run `node scripts/embed-all-voyage.js --2025`
