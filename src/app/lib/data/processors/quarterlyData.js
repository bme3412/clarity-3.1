/**
 * Processes quarterly financial data
 */

export function processQuarterlyData(rawData) {
    if (Array.isArray(rawData)) {
      return rawData.map(processQuarter);
    }
    return processQuarter(rawData);
  }
  
  function processQuarter(quarterData) {
    try {
      return {
        ...quarterData,
        segments: processSegments(quarterData.segments),
        metrics: normalizeMetrics(quarterData.operational_metrics),
        commentary: extractCommentary(quarterData.cfo_commentary)
      };
    } catch (error) {
      console.error('Error processing quarter:', error);
      throw new Error('Quarter processing failed');
    }
  }
  
  function processSegments(segments) {
    if (!Array.isArray(segments)) return [];
    
    return segments
      .filter(segment => segment.name && segment.revenue)
      .map(segment => ({
        name: segment.name,
        revenue: segment.revenue,
        growth: {
          yoy: segment.growth_yoy || null,
          qoq: segment.growth_qoq || null
        },
        highlights: segment.key_points || []
      }));
  }
  
  function normalizeMetrics(metrics) {
    if (!metrics) return {};
    
    return {
      gross_margin: metrics.gross_margin?.value || null,
      operating_margin: metrics.operating_margin?.value || null,
      context: metrics.gross_margin?.context || null
    };
  }
  
  function extractCommentary(commentary) {
    if (!commentary) return {};
    
    return {
      overview: commentary.introduction || [],
      segments: {
        datacenter: commentary.data_center || [],
        gaming: commentary.gaming || [],
        automotive: commentary.automotive || [],
        proviz: commentary.proviz || []
      }
    };
  }