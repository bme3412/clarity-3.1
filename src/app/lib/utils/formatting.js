/**
 * Response formatting utilities
 */

export function formatAnalysisResponse(analysis) {
    return {
      summary: formatSummary(analysis.main_analysis),
      trends: formatTrends(analysis.trends),
      thematic_insights: formatThematicInsights(analysis.thematic_insights),
      metadata: analysis.metadata
    };
  }
  
  function formatSummary(mainAnalysis) {
    // Split analysis into sections
    const sections = mainAnalysis.split('\n\n');
    
    return sections.map(section => {
      const lines = section.split('\n');
      const title = lines[0];
      const content = lines.slice(1).join('\n');
      
      return {
        title: title.replace(/:#/g, '').trim(),
        content: content.trim()
      };
    });
  }
  
  function formatTrends(trends) {
    if (!trends) return null;
  
    return {
      revenue: {
        data: trends.revenue.trend_data,
        summary: trends.revenue.summary,
        visualization_data: prepareChartData(trends.revenue.trend_data)
      },
      segments: Object.entries(trends.segments).map(([name, data]) => ({
        name,
        revenue_trend: data.revenue,
        growth_trend: data.growth,
        key_highlights: data.highlights
      })),
      margins: {
        gross: formatMarginTrend(trends.margins.gross_margin),
        operating: formatMarginTrend(trends.margins.operating_margin)
      }
    };
  }
  
  function formatThematicInsights(insights) {
    if (!insights) return null;
  
    return {
      ai_initiatives: {
        strategic: insights.ai_initiatives.initiatives,
        products: insights.ai_initiatives.products,
        customers: insights.ai_initiatives.customers
      },
      market_position: {
        target_markets: insights.market_positioning.target_markets,
        competitive_advantages: insights.market_positioning.competitive_advantages,
        opportunities: insights.market_positioning.market_opportunities
      },
      customer_wins: formatCustomerWins(insights.customer_wins)
    };
  }
  
  function formatMarginTrend(marginData) {
    if (!marginData) return null;
  
    return {
      values: marginData.map(point => ({
        period: point.period,
        value: point.value,
        change: point.change
      })),
      trend: calculateTrendDirection(marginData)
    };
  }
  
  function formatCustomerWins(customerData) {
    return Object.entries(customerData).map(([category, wins]) => ({
      category,
      wins: wins.map(win => ({
        description: win,
        quarter: extractQuarterFromWin(win)
      }))
    }));
  }
  
  // Helper functions
  function prepareChartData(trendData) {
    return {
      labels: trendData.map(d => d.period),
      datasets: [{
        label: 'Revenue',
        data: trendData.map(d => d.value)
      }]
    };
  }
  
  function calculateTrendDirection(data) {
    if (!data.length) return 'insufficient_data';
    
    const values = data.map(d => d.value);
    const changes = values.slice(1).map((v, i) => v - values[i]);
    const positive = changes.filter(c => c > 0).length;
    const negative = changes.filter(c => c < 0).length;
    
    if (positive > negative) return 'increasing';
    if (negative > positive) return 'decreasing';
    return 'stable';
  }
  
  function extractQuarterFromWin(win) {
    const match = win.match(/FY\d{2}\s*Q[1-4]/i);
    return match ? match[0] : null;
  }