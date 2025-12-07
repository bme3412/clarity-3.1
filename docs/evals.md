# Evaluations (Golden Set + Reports)

This document explains how to run the RAG evaluation suite, where artifacts are stored, and what the latest baseline scores look like.

## Golden set
- Location: `data/evaluation/dataset.json`
- Coverage (11 cases): financial (3), strategy (3), comparison (1), market (2), executive (1), guidance (1)
- Format per case:
  - `id`, `question`, `ground_truth`
  - `category` (for filtering/reporting)
  - `expected_context_ids` (optional future use for recall/precision)

## Commands
- Full run (default dataset, full delay):  
  `node scripts/run-evals.js --strategy baseline`
- Smoke run (caps cases, shorter delays):  
  `node scripts/run-evals.js --smoke`
- Custom dataset:  
  `node scripts/run-evals.js --dataset data/evaluation/dataset.json --strategy baseline --limit 20`

## Outputs
- Per-run artifacts: `evaluation_reports/<strategy>/<run_id>/`
  - `run.json` (summary), `<case>.json` (per-case details)
- Latest summary (for UI badges): `evaluation_report.json`
- Markdown leaderboard (generated): `docs/evaluations/EVALUATION_REPORT.md` (via `scripts/generate-eval-report.js`)

## Current baseline (from `evaluation_report.json`)
- Relevance: 77.3%
- Faithfulness: 77.0%
- Accuracy: 65.0%
- Avg total latency: ~19.5s

## Notes
- Requires env: `ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, `VOYAGE_API_KEY`, optionally `RAG_STRATEGY_ID`.
- `--smoke` uses a short delay between judge calls and caps the sample size to stay CI-friendly.

