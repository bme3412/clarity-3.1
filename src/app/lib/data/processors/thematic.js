/**
 * Analyzes thematic elements across financial data
 */

export async function analyzeThematic(data) {
    return {
      ai_initiatives: extractAIInitiatives(data),
      product_developments: extractProductDevelopments(data),
      market_positioning: analyzeMarketPositioning(data),
      customer_wins: extractCustomerWins(data)
    };
  }
  
  function extractAIInitiatives(data) {
    const aiMentions = new Set();
    const aiProducts = new Set();
    const aiCustomers = new Set();
  
    data.forEach(quarter => {
      // Extract from strategic initiatives
      quarter.strategic_initiatives?.forEach(initiative => {
        if (isAIRelated(initiative)) {
          aiMentions.add(initiative);
        }
      });
  
      // Extract from segments
      quarter.segments?.forEach(segment => {
        segment.key_points?.forEach(point => {
          if (isAIRelated(point)) {
            if (point.includes('customer') || point.includes('partner')) {
              aiCustomers.add(point);
            } else if (point.includes('product') || point.includes('platform')) {
              aiProducts.add(point);
            } else {
              aiMentions.add(point);
            }
          }
        });
      });
  
      // Extract from CFO commentary
      if (quarter.cfo_commentary?.data_center) {
        quarter.cfo_commentary.data_center.forEach(comment => {
          if (isAIRelated(comment)) {
            aiMentions.add(comment);
          }
        });
      }
    });
  
    return {
      initiatives: Array.from(aiMentions),
      products: Array.from(aiProducts),
      customers: Array.from(aiCustomers)
    };
  }
  
  function extractProductDevelopments(data) {
    const products = {};
    
    ['Gaming', 'Data Center', 'Professional Visualization', 'Automotive'].forEach(segment => {
      products[segment] = extractSegmentProducts(data, segment);
    });
  
    return products;
  }
  
  function analyzeMarketPositioning(data) {
    const positioning = {
      target_markets: new Set(),
      competitive_advantages: new Set(),
      market_opportunities: new Set()
    };
  
    data.forEach(quarter => {
      // Extract from market opportunities
      quarter.market_opportunities?.forEach(opportunity => {
        positioning.market_opportunities.add(opportunity);
      });
  
      // Extract from strategic initiatives
      quarter.strategic_initiatives?.forEach(initiative => {
        if (initiative.includes('market') || initiative.includes('position')) {
          positioning.competitive_advantages.add(initiative);
        }
      });
  
      // Extract from segments
      quarter.segments?.forEach(segment => {
        positioning.target_markets.add(segment.name);
      });
    });
  
    return {
      target_markets: Array.from(positioning.target_markets),
      competitive_advantages: Array.from(positioning.competitive_advantages),
      market_opportunities: Array.from(positioning.market_opportunities)
    };
  }
  
  function extractCustomerWins(data) {
    const customers = {
      enterprise: new Set(),
      cloud: new Set(),
      automotive: new Set(),
      other: new Set()
    };
  
    data.forEach(quarter => {
      quarter.segments?.forEach(segment => {
        segment.key_points?.forEach(point => {
          if (point.includes('customer') || point.includes('partner')) {
            categorizeCustomerWin(point, customers);
          }
        });
      });
    });
  
    return {
      enterprise: Array.from(customers.enterprise),
      cloud: Array.from(customers.cloud),
      automotive: Array.from(customers.automotive),
      other: Array.from(customers.other)
    };
  }
  
  // Helper functions
  function isAIRelated(text) {
    const aiTerms = ['AI', 'artificial intelligence', 'machine learning', 'neural', 
                    'deep learning', 'inference', 'training'];
    return aiTerms.some(term => text.toLowerCase().includes(term.toLowerCase()));
  }
  
  function extractSegmentProducts(data, segment) {
    const products = new Set();
    
    data.forEach(quarter => {
      const segmentData = quarter.segments?.find(s => s.name === segment);
      segmentData?.key_points?.forEach(point => {
        if (point.includes('product') || point.includes('platform') || 
            point.includes('solution') || point.includes('technology')) {
          products.add(point);
        }
      });
    });
  
    return Array.from(products);
  }
  
  function categorizeCustomerWin(point, customers) {
    if (point.includes('cloud') || point.includes('hyperscale')) {
      customers.cloud.add(point);
    } else if (point.includes('automotive') || point.includes('car')) {
      customers.automotive.add(point);
    } else if (point.includes('enterprise')) {
      customers.enterprise.add(point);
    } else {
      customers.other.add(point);
    }
  }