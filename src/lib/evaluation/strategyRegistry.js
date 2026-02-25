/**
 * Strategy Registry - Track RAG strategy versions and their evaluation results
 * 
 * This module manages the history of RAG improvements for blog post documentation.
 * Each strategy version is tracked with its configuration, metrics, and changelog.
 */

import fs from 'fs';
import path from 'path';

const STRATEGIES_DIR = path.join(process.cwd(), 'src', 'lib', 'evaluation', 'strategies');
const REPORTS_DIR = path.join(process.cwd(), '_cleanup', 'evals', 'evaluation_reports');

export class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.loadStrategies();
  }

  /**
   * Load all strategy definitions from the strategies directory
   */
  loadStrategies() {
    if (!fs.existsSync(STRATEGIES_DIR)) {
      fs.mkdirSync(STRATEGIES_DIR, { recursive: true });
      return;
    }

    const files = fs.readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(STRATEGIES_DIR, file), 'utf-8');
        const strategy = JSON.parse(content);
        this.strategies.set(strategy.codename, strategy);
      } catch (e) {
        console.error(`Failed to load strategy ${file}:`, e.message);
      }
    }
  }

  /**
   * Get a strategy by codename
   */
  getStrategy(codename) {
    return this.strategies.get(codename);
  }

  /**
   * List all registered strategies
   */
  listStrategies() {
    return Array.from(this.strategies.values()).map(s => ({
      version: s.version,
      codename: s.codename,
      created_at: s.created_at,
      status: s.status,
      description: s.description
    }));
  }

  /**
   * Get evaluation results for a strategy
   */
  getEvaluationResults(codename) {
    const strategyDir = path.join(REPORTS_DIR, codename);
    if (!fs.existsSync(strategyDir)) {
      return [];
    }

    const runs = fs.readdirSync(strategyDir)
      .filter(d => fs.statSync(path.join(strategyDir, d)).isDirectory())
      .map(runId => {
        const runFile = path.join(strategyDir, runId, 'run.json');
        if (fs.existsSync(runFile)) {
          return JSON.parse(fs.readFileSync(runFile, 'utf-8'));
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return runs;
  }

  /**
   * Get the latest evaluation run for a strategy
   */
  getLatestRun(codename) {
    const runs = this.getEvaluationResults(codename);
    return runs.length > 0 ? runs[0] : null;
  }

  /**
   * Compare two strategies
   */
  compareStrategies(codename1, codename2) {
    const strategy1 = this.getStrategy(codename1);
    const strategy2 = this.getStrategy(codename2);
    const run1 = this.getLatestRun(codename1);
    const run2 = this.getLatestRun(codename2);

    if (!strategy1 || !strategy2) {
      throw new Error('One or both strategies not found');
    }

    const comparison = {
      strategies: {
        baseline: { ...strategy1, latest_run: run1 },
        comparison: { ...strategy2, latest_run: run2 }
      },
      metrics_delta: null,
      improvements: [],
      regressions: []
    };

    if (run1?.summary && run2?.summary) {
      const s1 = run1.summary;
      const s2 = run2.summary;

      comparison.metrics_delta = {
        relevance: {
          baseline: s1.avg_relevance,
          comparison: s2.avg_relevance,
          delta: s2.avg_relevance - s1.avg_relevance,
          delta_pct: ((s2.avg_relevance - s1.avg_relevance) / s1.avg_relevance * 100).toFixed(2)
        },
        faithfulness: {
          baseline: s1.avg_faithfulness,
          comparison: s2.avg_faithfulness,
          delta: s2.avg_faithfulness - s1.avg_faithfulness,
          delta_pct: ((s2.avg_faithfulness - s1.avg_faithfulness) / s1.avg_faithfulness * 100).toFixed(2)
        },
        accuracy: {
          baseline: s1.avg_accuracy,
          comparison: s2.avg_accuracy,
          delta: s2.avg_accuracy - s1.avg_accuracy,
          delta_pct: ((s2.avg_accuracy - s1.avg_accuracy) / s1.avg_accuracy * 100).toFixed(2)
        },
        latency_ms: {
          baseline: s1.timings_ms?.totalMs,
          comparison: s2.timings_ms?.totalMs,
          delta: (s2.timings_ms?.totalMs || 0) - (s1.timings_ms?.totalMs || 0),
          delta_pct: s1.timings_ms?.totalMs 
            ? (((s2.timings_ms?.totalMs || 0) - s1.timings_ms.totalMs) / s1.timings_ms.totalMs * 100).toFixed(2)
            : 'N/A'
        }
      };

      // Identify improvements and regressions
      for (const [metric, data] of Object.entries(comparison.metrics_delta)) {
        if (metric === 'latency_ms') {
          // Lower is better for latency
          if (data.delta < 0) {
            comparison.improvements.push({ metric, delta: data.delta, delta_pct: data.delta_pct });
          } else if (data.delta > 0) {
            comparison.regressions.push({ metric, delta: data.delta, delta_pct: data.delta_pct });
          }
        } else {
          // Higher is better for quality metrics
          if (data.delta > 0) {
            comparison.improvements.push({ metric, delta: data.delta, delta_pct: data.delta_pct });
          } else if (data.delta < 0) {
            comparison.regressions.push({ metric, delta: data.delta, delta_pct: data.delta_pct });
          }
        }
      }
    }

    return comparison;
  }

  /**
   * Generate a markdown report comparing all strategies
   */
  generateComparisonReport() {
    const strategies = this.listStrategies();
    let report = `# RAG Strategy Comparison Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `## Strategy Overview\n\n`;
    report += `| Version | Codename | Created | Status |\n`;
    report += `|---------|----------|---------|--------|\n`;

    for (const s of strategies) {
      report += `| ${s.version} | ${s.codename} | ${s.created_at} | ${s.status} |\n`;
    }

    report += `\n## Metrics Comparison\n\n`;
    report += `| Strategy | Relevance | Faithfulness | Accuracy | Avg Latency (ms) |\n`;
    report += `|----------|-----------|--------------|----------|------------------|\n`;

    for (const s of strategies) {
      const run = this.getLatestRun(s.codename);
      if (run?.summary) {
        const sum = run.summary;
        report += `| ${s.codename} | ${(sum.avg_relevance * 100).toFixed(1)}% | ${(sum.avg_faithfulness * 100).toFixed(1)}% | ${(sum.avg_accuracy * 100).toFixed(1)}% | ${sum.timings_ms?.totalMs?.toFixed(0) || 'N/A'} |\n`;
      } else {
        report += `| ${s.codename} | - | - | - | - |\n`;
      }
    }

    return report;
  }

  /**
   * Export data for blog post
   */
  exportForBlogPost() {
    const data = {
      generated_at: new Date().toISOString(),
      strategies: [],
      timeline: [],
      key_insights: []
    };

    const strategies = this.listStrategies().sort((a, b) => 
      new Date(a.created_at) - new Date(b.created_at)
    );

    let previousStrategy = null;

    for (const s of strategies) {
      const fullStrategy = this.getStrategy(s.codename);
      const latestRun = this.getLatestRun(s.codename);

      const strategyData = {
        ...fullStrategy,
        latest_metrics: latestRun?.summary || null,
        evaluation_runs: this.getEvaluationResults(s.codename).length
      };

      data.strategies.push(strategyData);

      // Build timeline entry
      const timelineEntry = {
        date: s.created_at,
        version: s.version,
        codename: s.codename,
        changes: fullStrategy.changelog || [],
        metrics: latestRun?.summary || null
      };

      if (previousStrategy && latestRun?.summary) {
        const prevRun = this.getLatestRun(previousStrategy.codename);
        if (prevRun?.summary) {
          timelineEntry.delta = {
            relevance: latestRun.summary.avg_relevance - prevRun.summary.avg_relevance,
            faithfulness: latestRun.summary.avg_faithfulness - prevRun.summary.avg_faithfulness,
            accuracy: latestRun.summary.avg_accuracy - prevRun.summary.avg_accuracy
          };
        }
      }

      data.timeline.push(timelineEntry);
      previousStrategy = s;
    }

    return data;
  }
}

export default StrategyRegistry;

