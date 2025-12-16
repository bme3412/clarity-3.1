"""
Generate a golden QA dataset for tool-calling RAG.

Categories:
- single_metric, growth_rate, trend, comparison, qualitative, hybrid, edge_cases
"""

import json
from pathlib import Path

OUTPUT = Path(__file__).resolve().parent.parent.parent / "data" / "evaluation" / "golden-qa.json"

TICKERS = ["AAPL", "AMD", "AMZN", "AVGO", "CRM", "GOOGL", "META", "MSFT", "NVDA", "ORCL"]

def build_entry(id_, question, category, ticker=None, expected_tool=None, difficulty="medium", ground_truth=""):
    return {
        "id": id_,
        "question": question,
        "ground_truth": ground_truth,
        "expected_tool": expected_tool or [],
        "category": category,
        "ticker": ticker,
        "difficulty": difficulty
    }


def main():
    data = []

    # Single metric
    data.append(build_entry("single_metric_1", "What was NVDA's revenue in Q3 FY2024?", "single_metric", "NVDA", ["get_financial_metrics"]))
    data.append(build_entry("single_metric_2", "What was Apple's EPS in Q1 FY2024?", "single_metric", "AAPL", ["get_financial_metrics"]))

    # Growth
    data.append(build_entry("growth_1", "What was AMD's YoY revenue growth in Q2 FY2024?", "growth_rate", "AMD", ["compute_growth_rate"]))
    data.append(build_entry("growth_2", "What was Microsoft’s QoQ net income change from Q3 to Q4 FY2024?", "growth_rate", "MSFT", ["compute_growth_rate"]))

    # Trend
    data.append(build_entry("trend_1", "Show Apple’s operating margin trend over the last 4 quarters.", "trend", "AAPL", ["get_multi_quarter_metrics"]))
    data.append(build_entry("trend_2", "Plot Meta's free cash flow over the last 3 quarters.", "trend", "META", ["get_multi_quarter_metrics"]))

    # Comparison
    data.append(build_entry("comparison_1", "Compare AWS and Azure revenue growth over the last two quarters.", "comparison", None, ["get_multi_quarter_metrics", "compute_growth_rate"], "hard"))

    # Qualitative
    data.append(build_entry("qual_1", "What did Jensen Huang say about AI demand?", "qualitative", "NVDA", ["search_earnings_transcript"]))
    data.append(build_entry("qual_2", "What did Tim Cook say about services growth?", "qualitative", "AAPL", ["search_earnings_transcript"]))

    # Hybrid
    data.append(build_entry("hybrid_1", "What was NVDA's data center revenue and what drove the growth?", "hybrid", "NVDA", ["get_financial_metrics", "search_earnings_transcript"], "hard"))

    # Edge
    data.append(build_entry("edge_1", "What was Tesla's revenue in Q1 2024?", "edge_cases", "TSLA", ["list_available_data"]))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data)} items to {OUTPUT}")


if __name__ == "__main__":
    main()
