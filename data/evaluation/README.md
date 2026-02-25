# RAG Evaluation System

This directory contains tools to evaluate the performance of the Next Copilot RAG pipeline.

## Structure

*   `dataset.json`: A collection of "Gold Standard" questions and expected answers/facts.
*   `evaluate-rag.js`: The main script that runs the evaluation.
*   `evaluator.js`: (in `src/lib/evaluation`) Logic for LLM-based grading.

## Metrics

We use an "LLM-as-a-Judge" approach, inspired by Ragas, to calculate:

1.  **Answer Relevance:** Does the generated answer directly address the user's question? (Score 0.0 - 1.0)
2.  **Faithfulness:** (Planned) Is the answer derived *only* from the retrieved context?

## Usage

1.  Ensure your `.env` file is set up with `ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, and `VOYAGE_API_KEY`.
2.  Run the evaluation:

```bash
node scripts/evaluate-rag.js
```

3.  Review the output in the console and the generated `evaluation_report.json`.

## Adding Test Cases

Add new objects to `data/evaluation/dataset.json` with the following format:

```json
{
  "id": "unique_id",
  "question": "Your question here",
  "ground_truth": "The expected answer or key facts.",
  "context_type": "financial"
}
```


