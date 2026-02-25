/**
 * Analyzes trends across multiple quarters
 */

export async function extractTrends(data) {
    const trends = {
      revenue: analyzeTotalRevenue(data),
      segments: analyzeSegmentTrends(data),
      margins: analyzeMarginTrends(data),
      strategic: analyzeStrategicTrends(data)
    };
  
    return trends;
  }
  
  function analyzeTotalRevenue(data) {
    const revenueData = data
      .sort((a, b) => a.fiscal_year - b.fiscal_year || a.quarter - b.quarter)
      .map(quarter => ({
        period: `FY${quarter.fiscal_year} Q${quarter.quarter}`,
        value: quarter.total_revenue.value,
        growth_yoy: calculateYoYGrowth(quarter)
      }));
  
    return {
      trend_data: revenueData,
      summary: generateTrendSummary(revenueData)
    };
  }
  
  function analyzeSegmentTrends(data) {
    const segments = {};
    
    // Get all unique segments
    const allSegments = new Set();
    data.forEach(quarter => {
      quarter.segments.forEach(segment => {
        allSegments.add(segment.name);
      });
    });
  
    // Analyze each segment
    allSegments.forEach(segmentName => {
      segments[segmentName] = {
        revenue: extractSegmentRevenue(data, segmentName),
        growth: extractSegmentGrowth(data, segmentName),
        highlights: extractSegmentHighlights(data, segmentName)
      };
    });
  
    return segments;
  }
  
  function analyzeMarginTrends(data) {
    return {
      gross_margin: extractMarginTrend(data, 'gross_margin'),
      operating_margin: extractMarginTrend(data, 'operating_margin')
    };
  }
  
  function analyzeStrategicTrends(data) {
    const initiatives = new Set();
    const opportunities = new Set();
    
    data.forEach(quarter => {
      quarter.strategic_initiatives?.forEach(initiative => initiatives.add(initiative));
      quarter.market_opportunities?.forEach(opportunity => opportunities.add(opportunity));
    });
  
    return {
      initiatives: Array.from(initiatives),
      opportunities: Array.from(opportunities)
    };
  }
  
  // Helper functions
  function calculateYoYGrowth(quarter) {
    return quarter.total_revenue?.context
      ? extractGrowthFromContext(quarter.total_revenue.context)
      : null;
  }
  
  function extractGrowthFromContext(context) {
    const growthMatch = context.match(/up (\d+(?:\.\d+)?)%/);
    return growthMatch ? parseFloat(growthMatch[1]) : null;
  }
  
  function generateTrendSummary(trendData) {
    const growth = trendData
      .filter(d => d.growth_yoy)
      .map(d => d.growth_yoy);
      
    return {
      average_growth: growth.length ? 
        growth.reduce((a, b) => a + b, 0) / growth.length : null,
      trend_direction: determineTrendDirection(trendData)
    };
  }
  
  function determineTrendDirection(data) {
    if (data.length < 2) return 'insufficient_data';
    
    const values = data.map(d => d.value);
    const increases = values.slice(1).filter((v, i) => v > values[i]).length;
    const decreases = values.slice(1).filter((v, i) => v < values[i]).length;
    
    if (increases > decreases) return 'upward';
    if (decreases > increases) return 'downward';
    return 'stable';
  }