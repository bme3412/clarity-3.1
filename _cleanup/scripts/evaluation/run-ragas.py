"""
Run RAGAS evaluation against the tool-calling API.

This script expects the API to be running locally (or set API_BASE).
"""

import argparse
import asyncio
import json
from pathlib import Path
import os

import aiohttp

DATASET_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "evaluation" / "golden-qa.json"
RESULTS_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "evaluation" / "results"
API_BASE = os.environ.get("API_BASE", "http://localhost:3000")


async def fetch_answer(session, question):
  url = f"{API_BASE}/api/chat/stream"
  payload = {"message": question, "chatHistory": []}
  async with session.post(url, json=payload) as resp:
    if resp.status != 200:
      text = await resp.text()
      return {"error": f"HTTP {resp.status}: {text}"}
    # Simplified: consume entire SSE as text
    content = await resp.text()
    return {"raw": content}


async def main(args):
  if not DATASET_PATH.exists():
    raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")
  with DATASET_PATH.open("r", encoding="utf-8") as f:
    dataset = json.load(f)

  if args.categories:
    dataset = [d for d in dataset if d.get("category") in args.categories]

  if args.smoke:
    dataset = dataset[:5]
  elif args.limit:
    dataset = dataset[: args.limit]

  RESULTS_DIR.mkdir(parents=True, exist_ok=True)
  out_file = RESULTS_DIR / "ragas-run.jsonl"

  async with aiohttp.ClientSession() as session, out_file.open("w", encoding="utf-8") as outf:
    for item in dataset:
      result = await fetch_answer(session, item["question"])
      record = {
        "id": item["id"],
        "question": item["question"],
        "category": item.get("category"),
        "expected_tool": item.get("expected_tool"),
        "raw_response": result.get("raw"),
        "error": result.get("error")
      }
      outf.write(json.dumps(record) + "\n")
      print(f"Evaluated {item['id']} ({item['question'][:40]}...)")

  print(f"Saved results to {out_file}")


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--smoke", action="store_true", help="Run only 5 questions")
  parser.add_argument("--limit", type=int, help="Limit to N questions")
  parser.add_argument("--categories", nargs="+", help="Filter categories")
  args = parser.parse_args()
  asyncio.run(main(args))
