"""
Compare different retrieval strategies by querying the API with flags.
This is a lightweight harness; customize strategy parameters in the query string or body.
"""

import argparse
import asyncio
import json
import os
from pathlib import Path

import aiohttp

DATASET_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "evaluation" / "golden-qa.json"
RESULTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "evaluation" / "results"
API_BASE = os.environ.get("API_BASE", "http://localhost:3000")


async def run_case(session, item, strategy):
  url = f"{API_BASE}/api/chat/stream"
  payload = {"message": item["question"], "chatHistory": [], "strategy": strategy}
  async with session.post(url, json=payload) as resp:
    text = await resp.text()
    return {
      "id": item["id"],
      "question": item["question"],
      "strategy": strategy,
      "status": resp.status,
      "raw_response": text
    }


async def main(args):
  if not DATASET_PATH.exists():
    raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
  with DATASET_PATH.open("r", encoding="utf-8") as f:
    dataset = json.load(f)

  if args.smoke:
    dataset = dataset[:5]
  elif args.limit:
    dataset = dataset[: args.limit]

  strategies = args.strategies or ["baseline", "dense-only", "hybrid-0.6"]
  RESULTS_DIR.mkdir(parents=True, exist_ok=True)
  out_file = RESULTS_DIR / "strategy-compare.jsonl"

  async with aiohttp.ClientSession() as session, out_file.open("w", encoding="utf-8") as outf:
    for item in dataset:
      for strat in strategies:
        result = await run_case(session, item, strat)
        outf.write(json.dumps(result) + "\n")
        print(f"{item['id']} [{strat}] -> {result['status']}")

  print(f"Saved comparison results to {out_file}")


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--smoke", action="store_true", help="Run only 5 questions")
  parser.add_argument("--limit", type=int, help="Limit to N questions")
  parser.add_argument("--strategies", nargs="+", help="Strategies to compare")
  args = parser.parse_args()
  asyncio.run(main(args))
