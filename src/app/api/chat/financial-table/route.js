// src/app/api/chat/financial-table/route.js

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { financials } from '../../../../lib/data/financials.js';

export async function POST(req) {
  try {
    const { responseId, query } = await req.json();
    
    if (!responseId) {
      return NextResponse.json(
        { error: 'Response ID is required' },
        { status: 400 }
      );
    }

    const financialTable = await generateFinancialTable(query);

    return NextResponse.json({
      financialTable: financialTable
    });

  } catch (error) {
    console.error('Financial table generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial table' },
      { status: 500 }
    );
  }
}

// Helper to find the latest available year for a specific quarter
function findLatestYearForQuarter(symbol, quarter) {
  try {
    const baseDir = path.join(process.cwd(), 'data', 'financials', symbol);
    if (!fs.existsSync(baseDir)) return null;
    
    // List FY directories
    const dirs = fs.readdirSync(baseDir).filter(d => d.startsWith('FY_'));
    // Sort descending to check most recent years first
    dirs.sort().reverse();
    
    for (const dir of dirs) {
      const year = dir.replace('FY_', '');
      const qDir = path.join(baseDir, dir, quarter);
      // Check if the quarter directory exists and has the JSON file
      if (fs.existsSync(qDir)) {
        const files = fs.readdirSync(qDir);
        if (files.some(f => f.endsWith('.json'))) {
          return year;
        }
      }
    }
  } catch (e) {
    console.error(`Error finding latest year for ${symbol} ${quarter}:`, e);
  }
  return null;
}

// Enhanced helper to parse metrics and timeframes from the prompt
function parseQueryDetails(prompt) {
  const promptLower = prompt.toLowerCase();
  
  console.log(`[parseQueryDetails] Parsing prompt: "${prompt}"`);
  
  // Parse metrics
  const metricMap = {
    revenue: ['revenue', 'sales', 'top-line', 'top line'],
    profit: ['operating income', 'op. income', 'profit', 'operating profit', 'income'],
    margin: ['operating margin', 'op. margin', 'margin', 'profitability'],
    netIncome: ['net income', 'bottom-line', 'bottom line', 'net profit'],
    grossMargin: ['gross margin'],
    grossProfit: ['gross profit'],
    growth: ['growth', 'yoy growth', 'year over year', 'trend'],
    cashFlow: ['cash flow', 'cashflow', 'operating cash flow', 'free cash flow', 'cash'],
    subscription: ['subscription', 'subscription revenue', 'recurring'],
  };
  
  const metrics = [];
  for (const [key, keywords] of Object.entries(metricMap)) {
    if (keywords.some(word => promptLower.includes(word))) {
      metrics.push(key);
    }
  }
  
  // Parse timeframes - Enhanced Regex
  const timeframes = [];
  
  // Standard Q1 2025 formats
  const quarterMatches = promptLower.match(/(q[1-4])\s*(\d{4})/gi);
  // text based quarters (1st quarter 2025)
  const textQuarterMatches = promptLower.match(/(\d)(?:st|nd|rd|th)?\s*quarter\s*(\d{4})?/gi);
  
  const yearMatches = promptLower.match(/(\d{4})/g);
  const fiscalYearMatches = promptLower.match(/fy\s*(\d{4})/gi);
  
  if (quarterMatches) {
    quarterMatches.forEach(match => {
      const [_, quarter, year] = /(q[1-4])\s*(\d{4})/i.exec(match);
      timeframes.push({ type: 'quarter', quarter: quarter.toUpperCase(), year });
    });
  }

  if (textQuarterMatches) {
     textQuarterMatches.forEach(match => {
        const [_, qNum, year] = /(\d)(?:st|nd|rd|th)?\s*quarter\s*(\d{4})?/i.exec(match);
        if (qNum) {
            timeframes.push({ 
                type: 'quarter', 
                quarter: `Q${qNum}`, 
                year: year || null // Year might be undefined here
            });
        }
     });
  }
  
  // Check for isolated "Q1", "Q2" etc if not already matched
  if (timeframes.length === 0) {
      const simpleQuarterMatch = promptLower.match(/\b(q[1-4])\b/i);
      if (simpleQuarterMatch) {
          timeframes.push({ type: 'quarter', quarter: simpleQuarterMatch[1].toUpperCase(), year: null });
      }
  }
  
  if (fiscalYearMatches) {
    fiscalYearMatches.forEach(match => {
      const year = match.match(/fy\s*(\d{4})/i)[1];
      timeframes.push({ type: 'fiscal_year', year });
    });
  } else if (yearMatches && !quarterMatches && !textQuarterMatches) {
    yearMatches.forEach(year => {
      timeframes.push({ type: 'year', year });
    });
  }
  
  // Parse company mentions - improved detection
  const companyKeywords = {
    apple: ['apple', 'aapl'],
    amazon: ['amazon', 'amzn'],
    microsoft: ['microsoft', 'msft'],
    google: ['google', 'alphabet', 'googl'],
    meta: ['meta', 'facebook', 'fb'],
    nvidia: ['nvidia', 'nvda'],
    amd: ['amd'],
    salesforce: ['salesforce', 'crm'],
    oracle: ['oracle', 'orcl'],
    broadcom: ['broadcom', 'avgo']
  };
  
  let detectedCompany = null;
  for (const [company, keywords] of Object.entries(companyKeywords)) {
    if (keywords.some(keyword => promptLower.includes(keyword))) {
      detectedCompany = company;
      break;
    }
  }
  
  // Find year if associated with quarter
  const quarterTimeframe = timeframes.find(t => t.type === 'quarter');
  let year = null;
  if (quarterTimeframe) {
      year = quarterTimeframe.year;
      // If year not in quarter object, try to find a standalone year in query
      if (!year) {
          const yearTimeframe = timeframes.find(t => t.type === 'year' || t.type === 'fiscal_year');
          if (yearTimeframe) year = yearTimeframe.year;
      }
  } else {
       const yearTimeframe = timeframes.find(t => t.type === 'year' || t.type === 'fiscal_year');
       if (yearTimeframe) year = yearTimeframe.year;
  }

  const parsedQuery = {
    company: detectedCompany,
    quarter: quarterTimeframe?.quarter || null,
    year: year,
    metrics: metrics.length > 0 ? metrics : Object.keys(metricMap),
    timeframe: timeframes.length > 0 ? 'specific' : 'quarterly',
    analysis_type: 'comprehensive'
  };
  
  // Determine analysis type based on metrics
  if (parsedQuery.metrics.includes('cashFlow')) {
    parsedQuery.analysis_type = 'cash_flow';
  } else if (parsedQuery.metrics.includes('revenue')) {
    parsedQuery.analysis_type = 'revenue';
  } else if (parsedQuery.metrics.includes('profit') || parsedQuery.metrics.includes('margin')) {
    parsedQuery.analysis_type = 'profit';
  } else if (parsedQuery.metrics.includes('subscription')) {
    parsedQuery.analysis_type = 'subscription';
  }
  
  console.log(`[parseQueryDetails] Final parsed query:`, parsedQuery);
  
  return {
    ...parsedQuery,
    isQuarterly: /quarterly|q[1-4]|quarter/i.test(promptLower),
    isEarnings: /earnings|financial|performance/i.test(promptLower),
    isHighlights: /highlights|key|main/i.test(promptLower),
    isRevenue: /revenue|sales|top-line/i.test(promptLower),
    isProfit: /profit|income|margin|bottom-line/i.test(promptLower),
    isCashFlow: /cash flow|cashflow|operating cash flow|free cash flow/i.test(promptLower),
    isSubscription: /subscription|recurring/i.test(promptLower)
  };
}

// Update generateFinancialTable to use the enhanced parsing
async function generateFinancialTable(query = '') {
  try {
    // Parse query details
    const queryDetails = parseQueryDetails(query);
    console.log('Query details:', queryDetails);
    
    // Detect company from query
    let companyName = "Tech Company";
    let companyData = null;
    
    const companyMap = {
      apple: {
        name: "Apple",
        symbol: "AAPL",
        fullName: "Apple Inc.",
        sector: "Consumer Electronics & Technology"
      },
      amazon: {
        name: "Amazon",
        symbol: "AMZN", 
        fullName: "Amazon.com Inc.",
        sector: "E-commerce & Cloud Computing"
      },
      microsoft: {
        name: "Microsoft",
        symbol: "MSFT",
        fullName: "Microsoft Corporation", 
        sector: "Software & Cloud Services"
      },
      google: {
        name: "Alphabet",
        symbol: "GOOGL",
        fullName: "Alphabet Inc.",
        sector: "Digital Advertising & Technology"
      },
      meta: {
        name: "Meta",
        symbol: "META",
        fullName: "Meta Platforms Inc.",
        sector: "Social Media & Digital Advertising"
      },
      nvidia: {
        name: "NVIDIA",
        symbol: "NVDA",
        fullName: "NVIDIA Corporation",
        sector: "Semiconductors & AI"
      },
      amd: {
        name: "AMD",
        symbol: "AMD",
        fullName: "Advanced Micro Devices Inc.",
        sector: "Semiconductors"
      },
      salesforce: {
        name: "Salesforce",
        symbol: "CRM",
        fullName: "Salesforce Inc.",
        sector: "Enterprise Software & CRM"
      },
      oracle: {
        name: "Oracle",
        symbol: "ORCL",
        fullName: "Oracle Corporation",
        sector: "Enterprise Software & Database"
      },
      broadcom: {
        name: "Broadcom",
        symbol: "AVGO",
        fullName: "Broadcom Inc.",
        sector: "Semiconductors & Infrastructure Software"
      }
    };
    
    if (queryDetails.company && companyMap[queryDetails.company]) {
      companyData = companyMap[queryDetails.company];
      companyName = companyData.name;
      console.log(`[generateFinancialTable] Company detected: ${companyName} (${companyData.symbol})`);
    } else {
      // Default to Apple if context implies it (or handled by caller)
      // But for now, log it.
      console.log(`[generateFinancialTable] No company detected. Query company: ${queryDetails.company}`);
    }

    // Auto-detect year if quarter specified but year missing
    if (companyData && queryDetails.quarter && !queryDetails.year) {
      console.log(`[generateFinancialTable] Quarter ${queryDetails.quarter} specified but year missing. Searching for latest...`);
      const latestYear = findLatestYearForQuarter(companyData.symbol, queryDetails.quarter);
      if (latestYear) {
        queryDetails.year = latestYear;
        console.log(`[generateFinancialTable] Found latest year: ${latestYear}`);
      }
    }
    
    // If we have a specific quarter and year, generate targeted analysis
    if (queryDetails.quarter && queryDetails.year) {
      return await generateSpecificQuarterAnalysis(companyName, companyData, queryDetails);
    }
    
    // Determine analysis type based on query details
    if (queryDetails.analysis_type === 'cash_flow') {
      return await generateCashFlowAnalysis(companyName, companyData, queryDetails);
    } else if (queryDetails.analysis_type === 'subscription') {
      return await generateSubscriptionAnalysis(companyName, companyData, queryDetails);
    } else if (queryDetails.isQuarterly && (queryDetails.isEarnings || queryDetails.isHighlights)) {
      return await generateQuarterlyHighlights(companyName, companyData, queryDetails);
    } else if (queryDetails.analysis_type === 'revenue') {
      return await generateRevenueAnalysis(companyName, companyData, queryDetails);
    } else if (queryDetails.analysis_type === 'profit') {
      return await generateProfitabilityAnalysis(companyName, companyData, queryDetails);
    }
    
    // Default comprehensive table
    const result = await generateComprehensiveAnalysis(companyName, companyData, queryDetails);
    
    // Convert ASCII table to structured format for consistency
    if (typeof result === 'string') {
      return convertAsciiToStructured(result);
    }
    
    return result;
    
  } catch (error) {
    console.error('Error in generateFinancialTable:', error);
    // Return a structured error response instead of throwing
    return {
      tableData: {
        title: `${companyName || 'Unknown'} (${companyData?.symbol || 'N/A'}) - FINANCIAL ANALYSIS`,
        headers: ["Metric", "Status"],
        rows: [{ metric: "Data Availability", values: ["No financial data available"] }]
      },
      summary: {},
      trends: [],
      highlights: ["Unable to generate financial table due to data unavailability"],
      source: "Financial data analysis system"
    };
  }
}

// New function to generate analysis for a specific quarter
async function generateSpecificQuarterAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  const quarter = queryDetails.quarter;
  const year = queryDetails.year;
  
  console.log(`[generateSpecificQuarterAnalysis] Generating for ${symbol} ${quarter} ${year}`);
  
  try {
    // Get the specific quarter data
    const quarterData = await getSpecificQuarterData(symbol, year, quarter);
    console.log(`[generateSpecificQuarterAnalysis] Quarter data retrieved:`, quarterData ? 'SUCCESS' : 'FAILED');
    
    if (quarterData) {
      // Get the previous year's same quarter for comparison
      const previousYear = (parseInt(year) - 1).toString();
      const previousQuarterData = await getSpecificQuarterData(symbol, previousYear, quarter);
      console.log(`[generateSpecificQuarterAnalysis] Previous year data retrieved:`, previousQuarterData ? 'SUCCESS' : 'FAILED');
      
      // Calculate YoY growth
      const revenueGrowth = previousQuarterData ? 
        calculateGrowth(quarterData.revenue, previousQuarterData.revenue) : null;
      const profitGrowth = previousQuarterData ? 
        calculateGrowth(quarterData.profit, previousQuarterData.profit) : null;
      const netIncomeGrowth = previousQuarterData ? 
        calculateGrowth(quarterData.netIncome, previousQuarterData.netIncome) : null;
      
      console.log(`[generateSpecificQuarterAnalysis] Calculated growth rates:`, {
        revenueGrowth,
        profitGrowth,
        netIncomeGrowth
      });
      
      const tableData = {
        title: `${companyName} (${companyData.symbol}) - ${quarter} ${year} FINANCIAL PERFORMANCE`,
        headers: ["Metric", `${quarter} ${year}`, `${quarter} ${previousYear}`, "YoY Change"],
        rows: [
          { metric: "Revenue", values: [quarterData.revenue, previousQuarterData?.revenue || null, revenueGrowth] },
          { metric: "Op. Income", values: [quarterData.profit, previousQuarterData?.profit || null, profitGrowth] },
          { metric: "Op. Margin", values: [quarterData.margin, previousQuarterData?.margin || null, quarterData.margin - (previousQuarterData?.margin || 0)] },
          { metric: "Net Income", values: [quarterData.netIncome, previousQuarterData?.netIncome || null, netIncomeGrowth] }
        ]
      };
      
      const summary = {
        latestRevenue: quarterData.revenue,
        latestGrowth: revenueGrowth,
        latestProfit: quarterData.profit,
        latestMargin: quarterData.margin,
        latestNetIncome: quarterData.netIncome
      };
      
      const highlights = [
        `Revenue: $${(quarterData.revenue / 1000).toFixed(1)}B (${revenueGrowth > 0 ? '+' : ''}${revenueGrowth?.toFixed(1) || 'N/A'}% YoY)`,
        `Operating Income: $${(quarterData.profit / 1000).toFixed(1)}B (${profitGrowth > 0 ? '+' : ''}${profitGrowth?.toFixed(1) || 'N/A'}% YoY)`,
        `Operating Margin: ${quarterData.margin?.toFixed(1) || 'N/A'}%`,
        `Net Income: $${(quarterData.netIncome / 1000).toFixed(1)}B (${netIncomeGrowth > 0 ? '+' : ''}${netIncomeGrowth?.toFixed(1) || 'N/A'}% YoY)`
      ];
      
      console.log(`[generateSpecificQuarterAnalysis] Returning structured data for ${quarter} ${year}`);
      return {
        tableData,
        summary,
        trends: [],
        highlights,
        source: `${companyName} ${quarter} ${year} earnings report`
      };
    }
  } catch (error) {
    console.error(`[generateSpecificQuarterAnalysis] Error generating specific quarter analysis for ${symbol} ${quarter} ${year}:`, error);
  }
  
  // Fallback if no data available
  console.log(`[generateSpecificQuarterAnalysis] No data available, returning fallback`);
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - ${quarter} ${year} FINANCIAL PERFORMANCE`,
      headers: ["Metric", `${quarter} ${year}`, `${quarter} ${parseInt(year) - 1}`, "YoY Change"],
      rows: [
        { metric: "Revenue", values: [null, null, null] },
        { metric: "Op. Income", values: [null, null, null] },
        { metric: "Op. Margin", values: [null, null, null] },
        { metric: "Net Income", values: [null, null, null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} ${quarter} ${year}`],
    source: `${companyName} ${quarter} ${year} earnings report`
  };
}

// Helper function to get data for a specific quarter
async function getSpecificQuarterData(symbol, fiscalYear, quarter) {
  try {
    const baseDir = path.join(process.cwd(), 'data', 'financials');
    const filePath = path.join(baseDir, symbol, `FY_${fiscalYear}`, quarter, `${symbol}_FY_${fiscalYear}_${quarter}.json`);
    
    console.log(`[getSpecificQuarterData] Looking for file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`[getSpecificQuarterData] No data file found at: ${filePath}`);
      return null;
    }
    
    console.log(`[getSpecificQuarterData] Found file, reading data...`);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const metrics = extractFinancialMetrics(rawData);
    
    if (metrics) {
      console.log(`[getSpecificQuarterData] Successfully extracted metrics for ${symbol} FY${fiscalYear} ${quarter}:`, {
        revenue: metrics.revenue,
        profit: metrics.profit,
        margin: metrics.margin,
        growth: metrics.growth
      });
      return {
        quarter: quarter,
        fiscalYear: fiscalYear,
        ...metrics
      };
    }
    
    console.log(`[getSpecificQuarterData] Failed to extract metrics from ${filePath}`);
    return null;
  } catch (error) {
    console.error(`[getSpecificQuarterData] Error reading specific quarter data for ${symbol} FY${fiscalYear} ${quarter}:`, error);
    return null;
  }
}

async function generateQuarterlyHighlights(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  // Try to get real financial data for the company
  let quarterlyData = null;
  let fiscalYear = queryDetails.year || queryDetails.quarter?.year || '2023';
  
  try {
    quarterlyData = await getRealFinancialData(symbol, fiscalYear);
  } catch (error) {
    console.log('Could not load real financial data, trying fallback years:', error.message);
    // Try different years if the requested year doesn't have data
    const fallbackYears = ['2024', '2022', '2021'];
    for (const year of fallbackYears) {
      try {
        quarterlyData = await getRealFinancialData(symbol, year);
        if (quarterlyData && quarterlyData.length > 0) {
          fiscalYear = year;
          break;
        }
      } catch (fallbackError) {
        console.log(`No data for ${symbol} FY${year}:`, fallbackError.message);
      }
    }
  }
  
  if (quarterlyData && quarterlyData.length > 0) {
    // Use real data
    const q1Data = quarterlyData.find(q => q.quarter === 'Q1') || { revenue: 0, profit: 0, margin: 0, growth: 0 };
    const q2Data = quarterlyData.find(q => q.quarter === 'Q2') || { revenue: 0, profit: 0, margin: 0, growth: 0 };
    const q3Data = quarterlyData.find(q => q.quarter === 'Q3') || { revenue: 0, profit: 0, margin: 0, growth: 0 };
    const q4Data = quarterlyData.find(q => q.quarter === 'Q4') || { revenue: 0, profit: 0, margin: 0, growth: 0 };
    
    // Create structured data for consistent rendering
    const tableData = {
      title: `${companyName} (${companyData.symbol}) - QUARTERLY EARNINGS ANALYSIS`,
      headers: ["Metric", `Q1 ${fiscalYear}`, `Q2 ${fiscalYear}`, `Q3 ${fiscalYear}`, `Q4 ${fiscalYear}`],
      rows: [
        {
          metric: "Revenue",
          values: [q1Data.revenue, q2Data.revenue, q3Data.revenue, q4Data.revenue]
        },
        {
          metric: "YoY Growth",
          values: [q1Data.growth, q2Data.growth, q3Data.growth, q4Data.growth]
        },
        {
          metric: "Op. Income",
          values: [q1Data.profit, q2Data.profit, q3Data.profit, q4Data.profit]
        },
        {
          metric: "Op. Margin",
          values: [q1Data.margin, q2Data.margin, q3Data.margin, q4Data.margin]
        }
      ]
    };
    
    const summary = {
      latestRevenue: q4Data.revenue,
      latestGrowth: q4Data.growth,
      latestProfit: q4Data.profit,
      latestMargin: q4Data.margin
    };
    
    const trends = [
      { quarter: `Q1 ${fiscalYear}`, revenue: q1Data.revenue, profit: q1Data.profit, margin: q1Data.margin },
      { quarter: `Q2 ${fiscalYear}`, revenue: q2Data.revenue, profit: q2Data.profit, margin: q2Data.margin },
      { quarter: `Q3 ${fiscalYear}`, revenue: q3Data.revenue, profit: q3Data.profit, margin: q3Data.margin },
      { quarter: `Q4 ${fiscalYear}`, revenue: q4Data.revenue, profit: q4Data.profit, margin: q4Data.margin }
    ];
    
    const highlights = [
      `${q4Data.growth > 0 ? 'Strong' : 'Mixed'} year-over-year growth across all quarters`,
      `${q4Data.margin > 5 ? 'Solid' : 'Improving'} margin performance`,
      "Consistent quarterly progression in financial metrics",
      `Revenue: $${(q4Data.revenue / 1000).toFixed(1)}B (${q4Data.growth > 0 ? '+' : ''}${q4Data.growth}% YoY)`,
      `Operating Income: $${(q4Data.profit / 1000).toFixed(1)}B`,
      `Operating Margin: ${q4Data.margin}%`
    ];
    
    return {
      tableData,
      summary,
      trends,
      highlights,
      source: `${companyName} quarterly earnings reports and financial filings.`
    };
  }
  
  // Fallback when no real data is available
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - QUARTERLY EARNINGS ANALYSIS`,
      headers: ["Metric", "Q1 2023", "Q2 2023", "Q3 2023", "Q4 2023"],
      rows: [
        { metric: "Revenue", values: [null, null, null, null] },
        { metric: "YoY Growth", values: [null, null, null, null] },
        { metric: "Op. Income", values: [null, null, null, null] },
        { metric: "Op. Margin", values: [null, null, null, null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} FY${fiscalYear}`],
    source: `${companyName} quarterly earnings reports and financial filings.`
  };
}

async function generateRevenueAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  // Try to get real financial data for the company - include FY 2024
  let fy2022Data = null;
  let fy2023Data = null;
  let fy2024Data = null;
  
  try {
    [fy2022Data, fy2023Data, fy2024Data] = await Promise.all([
      getRealFinancialData(symbol, '2022'),
      getRealFinancialData(symbol, '2023'),
      getRealFinancialData(symbol, '2024')
    ]);
  } catch (error) {
    console.log('Could not load real financial data for revenue analysis:', error.message);
  }
  
  // Determine which years have data and use the most recent ones
  const availableYears = [];
  if (fy2024Data && fy2024Data.length > 0) availableYears.push({ year: '2024', data: fy2024Data });
  if (fy2023Data && fy2023Data.length > 0) availableYears.push({ year: '2023', data: fy2023Data });
  if (fy2022Data && fy2022Data.length > 0) availableYears.push({ year: '2022', data: fy2022Data });
  
  // Use the two most recent years with data
  const year1 = availableYears[1] || availableYears[0];
  const year2 = availableYears[0];
  
  if (year2 && year2.data.length > 0) {
    const annualYear2 = aggregateAnnualData(year2.data);
    const annualYear1 = aggregateAnnualData(year1?.data);
    
    const revenueGrowth = calculateGrowth(annualYear2.revenue, annualYear1?.revenue);
    const opMargin = calculateMargin(annualYear2.profit, annualYear2.revenue);
    
    const tableData = {
      title: `${companyName} (${companyData.symbol}) - REVENUE PERFORMANCE ANALYSIS`,
      headers: ["Metric", `FY ${year1?.year || 'N/A'}`, `FY ${year2.year}`, "Change"],
      rows: [
        { metric: "Revenue", values: [annualYear1?.revenue || null, annualYear2.revenue, calculateDifference(annualYear2.revenue, annualYear1?.revenue)] },
        { metric: "Op. Income", values: [annualYear1?.profit || null, annualYear2.profit, calculateDifference(annualYear2.profit, annualYear1?.profit)] },
        { metric: "Op. Margin", values: [annualYear1?.margin || null, opMargin, opMargin - (annualYear1?.margin || 0)] }
      ]
    };
    
    const summary = {
      latestRevenue: annualYear2.revenue,
      latestGrowth: revenueGrowth,
      latestProfit: annualYear2.profit,
      latestMargin: opMargin
    };
    
    // Create trends with quarterly data from the most recent year
    const quarterlyData = year2.data || [];
    const trends = [];
    
    // Add quarterly trends if we have quarterly data
    if (quarterlyData.length > 0) {
      const q1Data = quarterlyData.find(q => q.quarter === 'Q1') || { revenue: 0, profit: 0, margin: 0 };
      const q2Data = quarterlyData.find(q => q.quarter === 'Q2') || { revenue: 0, profit: 0, margin: 0 };
      const q3Data = quarterlyData.find(q => q.quarter === 'Q3') || { revenue: 0, profit: 0, margin: 0 };
      const q4Data = quarterlyData.find(q => q.quarter === 'Q4') || { revenue: 0, profit: 0, margin: 0 };
      
      if (q1Data.revenue > 0) trends.push({ quarter: `Q1 ${year2.year}`, revenue: q1Data.revenue, profit: q1Data.profit, margin: q1Data.margin });
      if (q2Data.revenue > 0) trends.push({ quarter: `Q2 ${year2.year}`, revenue: q2Data.revenue, profit: q2Data.profit, margin: q2Data.margin });
      if (q3Data.revenue > 0) trends.push({ quarter: `Q3 ${year2.year}`, revenue: q3Data.revenue, profit: q3Data.profit, margin: q3Data.margin });
      if (q4Data.revenue > 0) trends.push({ quarter: `Q4 ${year2.year}`, revenue: q4Data.revenue, profit: q4Data.profit, margin: q4Data.margin });
    }
    
    // If no quarterly trends, add annual trend
    if (trends.length === 0) {
      trends.push({ quarter: `FY ${year2.year}`, revenue: annualYear2.revenue, profit: annualYear2.profit, margin: opMargin });
    }
    
    const highlights = [
      `Revenue: $${(annualYear2.revenue / 1000).toFixed(1)}B (${revenueGrowth > 0 ? '+' : ''}${revenueGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Income: $${(annualYear2.profit / 1000).toFixed(1)}B`,
      `Operating Margin: ${opMargin?.toFixed(1) || 'N/A'}%`
    ];
    
    return {
      tableData,
      summary,
      trends,
      highlights,
      source: `${companyName} financial reports and earnings calls.`
    };
  }
  
  // Fallback if no data available
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - REVENUE PERFORMANCE ANALYSIS`,
      headers: ["Metric", "FY 2023", "FY 2024", "Change"],
      rows: [
        { metric: "Revenue", values: [null, null, null] },
        { metric: "Op. Income", values: [null, null, null] },
        { metric: "Op. Margin", values: [null, null, null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} revenue analysis`],
    source: `${companyName} financial reports and earnings calls.`
  };
}

async function generateProfitabilityAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  // Try to get real financial data for the company - include FY 2024
  let fy2022Data = null;
  let fy2023Data = null;
  let fy2024Data = null;
  
  try {
    // Get data for the last three fiscal years
    [fy2022Data, fy2023Data, fy2024Data] = await Promise.all([
      getRealFinancialData(symbol, '2022'),
      getRealFinancialData(symbol, '2023'),
      getRealFinancialData(symbol, '2024')
    ]);
  } catch (error) {
    console.log('Could not load real financial data for profitability analysis:', error.message);
  }
  
  // Determine which years have data and use the most recent ones
  const availableYears = [];
  if (fy2024Data && fy2024Data.length > 0) availableYears.push({ year: '2024', data: fy2024Data });
  if (fy2023Data && fy2023Data.length > 0) availableYears.push({ year: '2023', data: fy2023Data });
  if (fy2022Data && fy2022Data.length > 0) availableYears.push({ year: '2022', data: fy2022Data });
  
  // Use the two most recent years with data
  const year1 = availableYears[1] || availableYears[0];
  const year2 = availableYears[0];
  
  if (year2 && year2.data.length > 0) {
    const annualYear2 = aggregateAnnualData(year2.data);
    const annualYear1 = aggregateAnnualData(year1?.data);
    
    // Calculate YoY growth rates
    const revenueGrowth = calculateGrowth(annualYear2.revenue, annualYear1?.revenue);
    const opIncomeGrowth = calculateGrowth(annualYear2.profit, annualYear1?.profit);
    const netIncomeGrowth = calculateGrowth(annualYear2.netIncome, annualYear1?.netIncome);
    
    // Calculate margins
    const opMarginYear1 = calculateMargin(annualYear1?.profit, annualYear1?.revenue);
    const opMarginYear2 = calculateMargin(annualYear2.profit, annualYear2.revenue);
    const netMarginYear1 = calculateMargin(annualYear1?.netIncome, annualYear1?.revenue);
    const netMarginYear2 = calculateMargin(annualYear2.netIncome, annualYear2.revenue);
    
    // Get quarterly data for trends from the most recent year
    const quarterlyData = year2.data || [];
    const q1Data = quarterlyData.find(q => q.quarter === 'Q1') || { revenue: 0, profit: 0, margin: 0 };
    const q2Data = quarterlyData.find(q => q.quarter === 'Q2') || { revenue: 0, profit: 0, margin: 0 };
    const q3Data = quarterlyData.find(q => q.quarter === 'Q3') || { revenue: 0, profit: 0, margin: 0 };
    const q4Data = quarterlyData.find(q => q.quarter === 'Q4') || { revenue: 0, profit: 0, margin: 0 };
    
    // Create structured data
    const tableData = {
      title: `${companyName} (${companyData.symbol}) - PROFITABILITY ANALYSIS`,
      headers: ["Metric", `FY ${year1?.year || 'N/A'}`, `FY ${year2.year}`, "Change"],
      rows: [
        {
          metric: "Revenue",
          values: [annualYear1?.revenue || null, annualYear2.revenue, calculateDifference(annualYear2.revenue, annualYear1?.revenue)]
        },
        {
          metric: "Op. Income",
          values: [annualYear1?.profit || null, annualYear2.profit, calculateDifference(annualYear2.profit, annualYear1?.profit)]
        },
        {
          metric: "Op. Margin",
          values: [opMarginYear1, opMarginYear2, opMarginYear2 - (opMarginYear1 || 0)]
        },
        {
          metric: "Net Income",
          values: [annualYear1?.netIncome || null, annualYear2.netIncome, calculateDifference(annualYear2.netIncome, annualYear1?.netIncome)]
        },
        {
          metric: "Net Margin",
          values: [netMarginYear1, netMarginYear2, netMarginYear2 - (netMarginYear1 || 0)]
        }
      ]
    };
    
    const summary = {
      latestRevenue: annualYear2.revenue,
      latestOpIncome: annualYear2.profit,
      latestOpMargin: opMarginYear2,
      latestNetIncome: annualYear2.netIncome,
      latestNetMargin: netMarginYear2
    };
    
    // Create trends with quarterly data from the most recent year
    const trends = [];
    
    // Add quarterly trends if we have quarterly data
    if (quarterlyData.length > 0) {
      if (q1Data.revenue > 0) trends.push({ quarter: `Q1 ${year2.year}`, revenue: q1Data.revenue, profit: q1Data.profit, margin: q1Data.margin });
      if (q2Data.revenue > 0) trends.push({ quarter: `Q2 ${year2.year}`, revenue: q2Data.revenue, profit: q2Data.profit, margin: q2Data.margin });
      if (q3Data.revenue > 0) trends.push({ quarter: `Q3 ${year2.year}`, revenue: q3Data.revenue, profit: q3Data.profit, margin: q3Data.margin });
      if (q4Data.revenue > 0) trends.push({ quarter: `Q4 ${year2.year}`, revenue: q4Data.revenue, profit: q4Data.profit, margin: q4Data.margin });
    }
    
    // If no quarterly trends, add annual trend
    if (trends.length === 0) {
      trends.push({ quarter: `FY ${year2.year}`, revenue: annualYear2.revenue, profit: annualYear2.profit, margin: opMarginYear2 });
    }
    
    const highlights = [
      `Revenue: $${(annualYear2.revenue / 1000).toFixed(1)}B (${revenueGrowth > 0 ? '+' : ''}${revenueGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Income: $${(annualYear2.profit / 1000).toFixed(1)}B (${opIncomeGrowth > 0 ? '+' : ''}${opIncomeGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Margin: ${opMarginYear2?.toFixed(1) || 'N/A'}% (${opMarginYear2 && opMarginYear1 ? (opMarginYear2 - opMarginYear1).toFixed(1) : 'N/A'} pts change)`,
      `Net Income: $${(annualYear2.netIncome / 1000).toFixed(1)}B (${netIncomeGrowth > 0 ? '+' : ''}${netIncomeGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Net Margin: ${netMarginYear2?.toFixed(1) || 'N/A'}% (${netMarginYear2 && netMarginYear1 ? (netMarginYear2 - netMarginYear1).toFixed(1) : 'N/A'} pts change)`
    ];
    
    return {
      tableData,
      summary,
      trends,
      highlights,
      source: `${companyName} financial reports and earnings calls.`
    };
  }
  
  // Fallback if no data available
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - PROFITABILITY ANALYSIS`,
      headers: ["Metric", "FY 2023", "FY 2024", "Change"],
      rows: [
        { metric: "Revenue", values: [null, null, null] },
        { metric: "Op. Income", values: [null, null, null] },
        { metric: "Op. Margin", values: [null, null, null] },
        { metric: "Net Income", values: [null, null, null] },
        { metric: "Net Margin", values: [null, null, null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} profitability analysis`],
    source: `${companyName} financial reports and earnings calls.`
  };
}

// Update generateComprehensiveAnalysis to accept a metrics array
async function generateComprehensiveAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  console.log(`[generateComprehensiveAnalysis] Starting for ${symbol} with metrics:`, queryDetails.metrics);
  
  // Try to get real financial data for the company - include FY 2024
  let fy2021Data = null;
  let fy2022Data = null;
  let fy2023Data = null;
  let fy2024Data = null;
  
  try {
    // Get data for multiple fiscal years
    [fy2021Data, fy2022Data, fy2023Data, fy2024Data] = await Promise.all([
      getRealFinancialData(symbol, '2021'),
      getRealFinancialData(symbol, '2022'),
      getRealFinancialData(symbol, '2023'),
      getRealFinancialData(symbol, '2024')
    ]);
    
    console.log(`[generateComprehensiveAnalysis] Data loaded:`, {
      fy2021: fy2021Data?.length || 0,
      fy2022: fy2022Data?.length || 0,
      fy2023: fy2023Data?.length || 0,
      fy2024: fy2024Data?.length || 0
    });
  } catch (error) {
    console.log('Could not load real financial data, using fallback:', error.message);
  }
  
  // Get aggregated annual data
  const annual2021 = aggregateAnnualData(fy2021Data);
  const annual2022 = aggregateAnnualData(fy2022Data);
  const annual2023 = aggregateAnnualData(fy2023Data);
  const annual2024 = aggregateAnnualData(fy2024Data);
  
  // Determine which years have data and use the most recent ones
  const availableYears = [];
  if (annual2024) availableYears.push({ year: '2024', data: annual2024 });
  if (annual2023) availableYears.push({ year: '2023', data: annual2023 });
  if (annual2022) availableYears.push({ year: '2022', data: annual2022 });
  if (annual2021) availableYears.push({ year: '2021', data: annual2021 });
  
  if (availableYears.length === 0) {
    // No data available at all
    return {
      tableData: {
        title: `${companyName} (${companyData?.symbol || 'N/A'}) - COMPREHENSIVE FINANCIAL ANALYSIS`,
        headers: ["Metric", "FY 2022", "FY 2023", "FY 2024"],
        rows: [
          { metric: "Revenue", values: [null, null, null] },
          { metric: "Op. Income", values: [null, null, null] },
          { metric: "Op. Margin", values: [null, null, null] },
          { metric: "Net Income", values: [null, null, null] }
        ]
      },
      summary: {},
      trends: [],
      highlights: [`No financial data available for ${companyName} comprehensive analysis`],
      source: `${companyName} financial reports and earnings calls.`
    };
  }
  
  // Use the three most recent years with data
  const year1 = availableYears[availableYears.length - 3] || availableYears[availableYears.length - 2] || availableYears[availableYears.length - 1];
  const year2 = availableYears[availableYears.length - 2] || availableYears[availableYears.length - 1];
  const year3 = availableYears[availableYears.length - 1];
  
  // Extract data with fallbacks using dynamic years
  const revenueYear1 = year1?.data?.revenue ?? null;
  const revenueYear2 = year2?.data?.revenue ?? null;
  const revenueYear3 = year3?.data?.revenue ?? null;
  
  // Calculate growth rates
  const growthYear2 = (revenueYear2 && revenueYear1) ? calculateGrowth(revenueYear2, revenueYear1) : null;
  const growthYear3 = (revenueYear3 && revenueYear2) ? calculateGrowth(revenueYear3, revenueYear2) : null;
  
  const grossProfitYear1 = year1?.data?.grossProfit ?? null;
  const grossProfitYear2 = year2?.data?.grossProfit ?? null;
  const grossProfitYear3 = year3?.data?.grossProfit ?? null;
  
  const grossMarginYear1 = year1?.data?.grossMargin ?? null;
  const grossMarginYear2 = year2?.data?.grossMargin ?? null;
  const grossMarginYear3 = year3?.data?.grossMargin ?? null;
  
  const opIncomeYear1 = year1?.data?.profit ?? null;
  const opIncomeYear2 = year2?.data?.profit ?? null;
  const opIncomeYear3 = year3?.data?.profit ?? null;
  
  const opMarginYear1 = year1?.data?.margin ?? null;
  const opMarginYear2 = year2?.data?.margin ?? null;
  const opMarginYear3 = year3?.data?.margin ?? null;
  
  const netIncomeYear1 = year1?.data?.netIncome ?? null;
  const netIncomeYear2 = year2?.data?.netIncome ?? null;
  const netIncomeYear3 = year3?.data?.netIncome ?? null;
  
  const netMarginYear1 = (revenueYear1 && netIncomeYear1) ? (netIncomeYear1 / revenueYear1 * 100) : null;
  const netMarginYear2 = (revenueYear2 && netIncomeYear2) ? (netIncomeYear2 / revenueYear2 * 100) : null;
  const netMarginYear3 = (revenueYear3 && netIncomeYear3) ? (netIncomeYear3 / revenueYear3 * 100) : null;
  
  // Helper to format or show N/A
  const fmt = (v, digits = 1, isPct = false) => v == null ? 'N/A' : (isPct ? v.toFixed(digits) + '%' : v.toLocaleString());
  
  // Only include rows for requested metrics
  const rows = [];
  if (queryDetails.metrics.includes('revenue')) rows.push(`| Revenue     | ${fmt(revenueYear1)}  | ${fmt(revenueYear2)}  | ${fmt(revenueYear3)}  |`);
  if (queryDetails.metrics.includes('growth')) rows.push(`| YoY Growth  |   ${fmt(null, 1, true)}   |   ${fmt(growthYear2, 1, true)}   |   ${fmt(growthYear3, 1, true)}   |`);
  if (queryDetails.metrics.includes('grossProfit')) rows.push(`| Gross Profit│ ${fmt(grossProfitYear1)}  │ ${fmt(grossProfitYear2)}  │ ${fmt(grossProfitYear3)}  │`);
  if (queryDetails.metrics.includes('grossMargin')) rows.push(`| Gross Margin│   ${fmt(grossMarginYear1, 1, true)}   │   ${fmt(grossMarginYear2, 1, true)}   │   ${fmt(grossMarginYear3, 1, true)}   │`);
  if (queryDetails.metrics.includes('profit')) rows.push(`| Op. Income  │   ${fmt(opIncomeYear1)}  │   ${fmt(opIncomeYear2)}  │   ${fmt(opIncomeYear3)}  │`);
  if (queryDetails.metrics.includes('margin')) rows.push(`| Op. Margin  │    ${fmt(opMarginYear1, 1, true)}   │    ${fmt(opMarginYear2, 1, true)}   │    ${fmt(opMarginYear3, 1, true)}   │`);
  if (queryDetails.metrics.includes('netIncome')) rows.push(`| Net Income  │   ${fmt(netIncomeYear1)}  │   ${fmt(netIncomeYear2)}  │   ${fmt(netIncomeYear3)}  │`);
  if (queryDetails.metrics.includes('netMargin')) rows.push(`| Net Margin  │    ${fmt(netMarginYear1, 1, true)}   │    ${fmt(netMarginYear2, 1, true)}   │    ${fmt(netMarginYear3, 1, true)}   │`);
  
  console.log(`[generateComprehensiveAnalysis] Final rows:`, rows);
  
  // If we have data, return structured format
  if (rows.length > 0) {
    const tableData = {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - COMPREHENSIVE FINANCIAL ANALYSIS`,
      headers: ["Metric", `FY ${year1?.year || 'N/A'}`, `FY ${year2?.year || 'N/A'}`, `FY ${year3?.year || 'N/A'}`],
      rows: [
        { metric: "Revenue", values: [revenueYear1, revenueYear2, revenueYear3] },
        { metric: "YoY Growth", values: [null, growthYear2, growthYear3] },
        { metric: "Op. Income", values: [opIncomeYear1, opIncomeYear2, opIncomeYear3] },
        { metric: "Op. Margin", values: [opMarginYear1, opMarginYear2, opMarginYear3] },
        { metric: "Net Income", values: [netIncomeYear1, netIncomeYear2, netIncomeYear3] },
        { metric: "Net Margin", values: [netMarginYear1, netMarginYear2, netMarginYear3] }
      ]
    };
    
    const summary = {
      latestRevenue: revenueYear3,
      latestGrowth: growthYear3,
      latestOpIncome: opIncomeYear3,
      latestOpMargin: opMarginYear3,
      latestNetIncome: netIncomeYear3,
      latestNetMargin: netMarginYear3
    };
    
    const highlights = [
      `Revenue: $${(revenueYear3 / 1000).toFixed(1)}B (${growthYear3 > 0 ? '+' : ''}${growthYear3?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Income: $${(opIncomeYear3 / 1000).toFixed(1)}B`,
      `Operating Margin: ${opMarginYear3?.toFixed(1) || 'N/A'}%`,
      `Net Income: $${(netIncomeYear3 / 1000).toFixed(1)}B`,
      `Net Margin: ${netMarginYear3?.toFixed(1) || 'N/A'}%`
    ];
    
    return {
      tableData,
      summary,
      trends: [],
      highlights,
      source: `${companyName} financial reports and earnings calls.`
    };
  }
  
  // Fallback to ASCII format if no structured data
  return `${companyName} (${companyData?.symbol || 'N/A'}) - COMPREHENSIVE FINANCIAL ANALYSIS
$ millions except per share data

INCOME STATEMENT SUMMARY
+-------------+----------+----------+----------+
|             | FY ${year1?.year || 'N/A'}  | FY ${year2?.year || 'N/A'}  | FY ${year3?.year || 'N/A'}  |
+-------------+----------+----------+----------+
${rows.join('\n')}
+-------------+----------+----------+----------+

Source: ${companyName} quarterly earnings reports and financial filings.`;
}

async function generateCashFlowAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  // For NVIDIA, we need to handle fiscal year differently
  // NVIDIA's fiscal year 2024 runs from May 2023 to April 2024
  // So we need to get the most recent 4 quarters of data
  let quarterlyData = null;
  let fiscalYear = '2024'; // Default to most recent
  
  try {
    // Try to get the most recent fiscal year data
    quarterlyData = await getRealFinancialData(symbol, fiscalYear);
    
    // If we don't have enough data, try the previous fiscal year
    if (!quarterlyData || quarterlyData.length < 4) {
      fiscalYear = '2023';
      quarterlyData = await getRealFinancialData(symbol, fiscalYear);
    }
    
    // If still no data, try other years
    if (!quarterlyData || quarterlyData.length < 4) {
      const fallbackYears = ['2022', '2021'];
      for (const year of fallbackYears) {
        try {
          quarterlyData = await getRealFinancialData(symbol, year);
          if (quarterlyData && quarterlyData.length > 0) {
            fiscalYear = year;
            break;
          }
        } catch (fallbackError) {
          console.log(`No data for ${symbol} FY${year}:`, fallbackError.message);
        }
      }
    }
    
    console.log(`[generateCashFlowAnalysis] Using fiscal year ${fiscalYear} with ${quarterlyData?.length || 0} quarters of data`);
  } catch (error) {
    console.log('Could not load real financial data, using fallback:', error.message);
  }
  
  if (quarterlyData && quarterlyData.length > 0) {
    // Sort quarters in chronological order
    const quarterOrder = ['Q1', 'Q2', 'Q3', 'Q4'];
    quarterlyData.sort((a, b) => quarterOrder.indexOf(a.quarter) - quarterOrder.indexOf(b.quarter));
    
    // Get the last 4 quarters of data
    const recentQuarters = quarterlyData.slice(-4);
    
    // Create structured data for consistent rendering
    const tableData = {
      title: `${companyName} (${companyData.symbol}) - QUARTERLY CASH FLOW PERFORMANCE`,
      headers: ["Metric", ...recentQuarters.map(q => `${q.quarter} ${fiscalYear}`)],
      rows: [
        {
          metric: "Op. Cash Flow",
          values: recentQuarters.map(q => q.operatingCashFlow || null)
        },
        {
          metric: "Free Cash Flow", 
          values: recentQuarters.map(q => q.freeCashFlow || null)
        },
        {
          metric: "Cash Flow Margin",
          values: recentQuarters.map(q => q.cashFlowMargin || null)
        }
      ]
    };
    
    const summary = {
      latestOperatingCashFlow: recentQuarters[recentQuarters.length - 1]?.operatingCashFlow || null,
      latestFreeCashFlow: recentQuarters[recentQuarters.length - 1]?.freeCashFlow || null,
      latestCashFlowMargin: recentQuarters[recentQuarters.length - 1]?.cashFlowMargin || null
    };
    
    const trends = recentQuarters.map(q => ({
      quarter: `${q.quarter} ${fiscalYear}`,
      revenue: q.operatingCashFlow, // Use operating cash flow as "revenue" for display
      profit: q.freeCashFlow, // Use free cash flow as "profit" for display  
      margin: q.cashFlowMargin // Use cash flow margin as "margin" for display
    }));
    
    const highlights = [
      "Strong operating cash generation across all quarters",
      "Consistent margin performance driving cash flow growth", 
      "Efficient working capital management",
      "Robust cash conversion cycle"
    ];
    
    return {
      tableData,
      summary,
      trends,
      highlights,
      source: `${companyName} quarterly earnings reports and financial filings.`
    };
  }
  
  // Fallback if no data available
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - QUARTERLY CASH FLOW PERFORMANCE`,
      headers: ["Metric", "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024"],
      rows: [
        { metric: "Op. Cash Flow", values: [null, null, null, null] },
        { metric: "Free Cash Flow", values: [null, null, null, null] },
        { metric: "Cash Flow Margin", values: [null, null, null, null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} cash flow analysis`],
    source: `${companyName} quarterly earnings reports and financial filings.`
  };
}

async function generateSubscriptionAnalysis(companyName, companyData, queryDetails) {
  const symbol = companyData?.symbol || "TECH";
  
  // For subscription revenue, we need to get the most recent fiscal year data
  let fy2023Data = null;
  let fiscalYear = '2023';
  
  try {
    fy2023Data = await getRealFinancialData(symbol, fiscalYear);
    
    // If no data for 2023, try other years
    if (!fy2023Data || fy2023Data.length === 0) {
      const fallbackYears = ['2024', '2022', '2021'];
      for (const year of fallbackYears) {
        try {
          fy2023Data = await getRealFinancialData(symbol, year);
          if (fy2023Data && fy2023Data.length > 0) {
            fiscalYear = year;
            break;
          }
        } catch (fallbackError) {
          console.log(`No data for ${symbol} FY${year}:`, fallbackError.message);
        }
      }
    }
  } catch (error) {
    console.log('Could not load real financial data for subscription analysis:', error.message);
  }
  
  if (fy2023Data && fy2023Data.length > 0) {
    const annual = aggregateAnnualData(fy2023Data);
    
    const revenueGrowth = calculateGrowth(annual.revenue, 0); // No previous year for YoY growth
    const opIncomeGrowth = calculateGrowth(annual.profit, 0);
    const netIncomeGrowth = calculateGrowth(annual.netIncome, 0);
    
    const opMargin = calculateMargin(annual.profit, annual.revenue);
    const netMargin = calculateMargin(annual.netIncome, annual.revenue);
    
    const tableData = {
      title: `${companyName} (${companyData.symbol}) - SUBSCRIPTION REVENUE ANALYSIS`,
      headers: ["Metric", `FY ${fiscalYear}`],
      rows: [
        { metric: "Revenue", values: [annual.revenue] },
        { metric: "Op. Income", values: [annual.profit] },
        { metric: "Op. Margin", values: [opMargin] },
        { metric: "Net Income", values: [annual.netIncome] },
        { metric: "Net Margin", values: [netMargin] }
      ]
    };
    
    const summary = {
      latestRevenue: annual.revenue,
      latestOpIncome: annual.profit,
      latestOpMargin: opMargin,
      latestNetIncome: annual.netIncome,
      latestNetMargin: netMargin
    };
    
    const trends = [
      { quarter: `FY ${fiscalYear}`, revenue: annual.revenue, profit: annual.profit, margin: opMargin }
    ];
    
    const highlights = [
      `Revenue: $${(annual.revenue / 1000).toFixed(1)}B (${revenueGrowth > 0 ? '+' : ''}${revenueGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Income: $${(annual.profit / 1000).toFixed(1)}B (${opIncomeGrowth > 0 ? '+' : ''}${opIncomeGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Operating Margin: ${opMargin?.toFixed(1) || 'N/A'}%`,
      `Net Income: $${(annual.netIncome / 1000).toFixed(1)}B (${netIncomeGrowth > 0 ? '+' : ''}${netIncomeGrowth?.toFixed(1) || 'N/A'}% YoY)`,
      `Net Margin: ${netMargin?.toFixed(1) || 'N/A'}%`
    ];
    
    return {
      tableData,
      summary,
      trends,
      highlights,
      source: `${companyName} financial reports and earnings calls.`
    };
  }
  
  // Fallback if no data available
  return {
    tableData: {
      title: `${companyName} (${companyData?.symbol || 'N/A'}) - SUBSCRIPTION REVENUE ANALYSIS`,
      headers: ["Metric", "FY 2023"],
      rows: [
        { metric: "Revenue", values: [null] },
        { metric: "Op. Income", values: [null] },
        { metric: "Op. Margin", values: [null] },
        { metric: "Net Income", values: [null] },
        { metric: "Net Margin", values: [null] }
      ]
    },
    summary: {},
    trends: [],
    highlights: [`No financial data available for ${companyName} subscription revenue analysis`],
    source: `${companyName} financial reports and earnings calls.`
  };
}

// Helper function to aggregate quarterly data into annual data
const aggregateAnnualData = (quarterlyData) => {
  if (!quarterlyData || quarterlyData.length === 0) return null;
  
  const annual = {
    revenue: 0,
    profit: 0,
    netIncome: 0,
    grossProfit: 0,
    grossMargin: 0,
    margin: 0,
    growth: 0
  };
  
  quarterlyData.forEach(q => {
    annual.revenue += q.revenue || 0;
    annual.profit += q.profit || 0;
    annual.netIncome += q.netIncome || 0;
    annual.grossProfit += q.grossProfit || 0;
  });
  
  // Calculate average margins
  const validMargins = quarterlyData.filter(q => q.margin > 0);
  const validGrossMargins = quarterlyData.filter(q => q.grossMargin > 0);
  
  if (validMargins.length > 0) {
    annual.margin = validMargins.reduce((sum, q) => sum + q.margin, 0) / validMargins.length;
  }
  if (validGrossMargins.length > 0) {
    annual.grossMargin = validGrossMargins.reduce((sum, q) => sum + q.grossMargin, 0) / validGrossMargins.length;
  }
  
  // Use the most recent growth rate
  const recentGrowth = quarterlyData.find(q => q.growth !== 0);
  if (recentGrowth) {
    annual.growth = recentGrowth.growth;
  }
  
  console.log(`[aggregateAnnualData] Aggregated:`, annual);
  return annual;
};

// Helper function to calculate YoY growth (percentage)
const calculateGrowth = (current, previous) => {
  if (!current || !previous || previous === 0) return null;
  return ((current - previous) / previous * 100);
};

// Helper function to calculate absolute difference
const calculateDifference = (current, previous) => {
  if (!current || !previous) return null;
  return current - previous;
};

// Helper function to calculate margin
const calculateMargin = (profit, revenue) => {
  if (!profit || !revenue || revenue === 0) return null;
  return (profit / revenue) * 100;
};

// Helper function to get real financial data (optimized with caching)
async function getRealFinancialData(symbol, fiscalYear) {
  try {
    // Use cached data for better performance
    const data = await financials.getMultipleQuarters(symbol, fiscalYear);
    
    console.log(`[getRealFinancialData] Retrieved ${data.length} quarters for ${symbol} FY${fiscalYear}`);
    
    return data;
  } catch (error) {
    console.log(`Error getting financial data for ${symbol} FY${fiscalYear}:`, error.message);
    return [];
  }
}

// Helper function to extract key metrics from financial JSON
function extractFinancialMetrics(jsonData) {
  try {
    const report = jsonData.financial_report || jsonData.financial_reports?.[0];
    if (!report) return null;
    
    const incomeStatement = report.income_statement;
    if (!incomeStatement) return null;
    
    // Extract revenue - handle different field names
    let revenue = 0;
    if (incomeStatement.net_sales?.total?.value) {
      revenue = incomeStatement.net_sales.total.value;
    } else if (incomeStatement.revenue?.total?.value) {
      revenue = incomeStatement.revenue.total.value;
    } else if (incomeStatement.revenues?.total?.value) {
      revenue = incomeStatement.revenues.total.value;
    }
    
    // Extract operating income - handle different structures
    let profit = 0;
    if (incomeStatement.operating_income?.total) {
      profit = incomeStatement.operating_income.total;
    } else if (incomeStatement.operating_income?.value) {
      profit = incomeStatement.operating_income.value;
    } else if (incomeStatement.operating_income?.gaap?.value) {
      profit = incomeStatement.operating_income.gaap.value;
    } else if (incomeStatement.operating_income?.non_gaap?.value) {
      profit = incomeStatement.operating_income.non_gaap.value;
    } else if (incomeStatement.margins?.operating_margin?.operating_income) {
      profit = incomeStatement.margins.operating_margin.operating_income;
    }
    
    // Extract margin - handle different structures
    let margin = 0;
    if (incomeStatement.operating_income?.margin_percentage) {
      margin = parseFloat(incomeStatement.operating_income.margin_percentage);
    } else if (incomeStatement.margins?.operating_margin?.current_value) {
      margin = incomeStatement.margins.operating_margin.current_value;
    } else if (incomeStatement.margins?.operating_margin?.gaap?.operating_margin) {
      margin = incomeStatement.margins.operating_margin.gaap.operating_margin;
    } else if (incomeStatement.margins?.operating_margin?.non_gaap?.operating_margin) {
      margin = incomeStatement.margins.operating_margin.non_gaap.operating_margin;
    } else if (revenue > 0 && profit > 0) {
      margin = (profit / revenue) * 100;
    }
    
    // Extract net income
    let netIncome = 0;
    if (incomeStatement.net_income?.value) {
      netIncome = incomeStatement.net_income.value;
    } else if (incomeStatement.net_income?.gaap?.value) {
      netIncome = incomeStatement.net_income.gaap.value;
    } else if (incomeStatement.net_income?.non_gaap?.value) {
      netIncome = incomeStatement.net_income.non_gaap.value;
    }
    
    // Extract gross profit
    let grossProfit = 0;
    if (incomeStatement.margins?.gross_margin?.gross_profit) {
      grossProfit = incomeStatement.margins.gross_margin.gross_profit;
    } else if (incomeStatement.gross_profit?.value) {
      grossProfit = incomeStatement.gross_profit.value;
    } else if (incomeStatement.gross_profit?.gaap?.value) {
      grossProfit = incomeStatement.gross_profit.gaap.value;
    }
    
    // Extract gross margin
    let grossMargin = 0;
    if (incomeStatement.margins?.gross_margin?.current_value) {
      grossMargin = incomeStatement.margins.gross_margin.current_value;
    } else if (incomeStatement.margins?.gross_margin?.gaap?.gross_margin) {
      grossMargin = incomeStatement.margins.gross_margin.gaap.gross_margin;
    } else if (revenue > 0 && grossProfit > 0) {
      grossMargin = (grossProfit / revenue) * 100;
    }
    
    // Extract cash flow data
    let operatingCashFlow = 0;
    let freeCashFlow = 0;
    let cashFlowMargin = 0;
    
    // Try different cash flow structures
    if (report.cash_flow) {
      if (report.cash_flow.operating_cash_flow) {
        operatingCashFlow = report.cash_flow.operating_cash_flow;
      }
      if (report.cash_flow.free_cash_flow) {
        freeCashFlow = report.cash_flow.free_cash_flow;
      }
    }
    
    // Try Q2-Q4 2024 structure - free_cash_flow directly under financial_report
    if (report.free_cash_flow?.value) {
      freeCashFlow = report.free_cash_flow.value;
    }
    
    // Try Q2-Q4 2024 structure for operating cash flow
    if (report.cash_flow_from_operations?.total_operating_cash_flow?.value) {
      operatingCashFlow = report.cash_flow_from_operations.total_operating_cash_flow.value;
    }
    
    // Try metrics structure for operating cash flow (Q2-Q4)
    if (report.metrics?.key_metrics?.operating_cash_flow_margin?.components?.operating_cash_flow) {
      operatingCashFlow = report.metrics.key_metrics.operating_cash_flow_margin.components.operating_cash_flow;
    }
    
    // Try Q2-Q4 2024 structure (fallback)
    if (report.cash_flow?.cash_flow_from_operations?.total_operating_cash_flow?.value) {
      operatingCashFlow = report.cash_flow.cash_flow_from_operations.total_operating_cash_flow.value;
    }
    
    // Calculate cash flow margin as operating cash flow / revenue
    if (operatingCashFlow > 0 && revenue > 0) {
      cashFlowMargin = (operatingCashFlow / revenue) * 100;
    }
    
    // Extract growth rate if available
    let growth = 0;
    if (incomeStatement.net_sales?.total?.yoy_growth) {
      growth = incomeStatement.net_sales.total.yoy_growth;
    } else if (incomeStatement.revenue?.total?.yoy_growth) {
      growth = incomeStatement.revenue.total.yoy_growth;
    } else if (incomeStatement.revenues?.total?.yoy_growth) {
      growth = incomeStatement.revenues.total.yoy_growth;
    } else if (incomeStatement.operating_income?.yoy_growth) {
      growth = incomeStatement.operating_income.yoy_growth;
    }
    
    console.log(`[extractFinancialMetrics] Extracted for ${report.period?.fiscal_quarter}:`, {
      revenue,
      profit,
      margin,
      growth,
      netIncome,
      grossMargin,
      grossProfit,
      operatingCashFlow,
      freeCashFlow,
      cashFlowMargin
    });
    
    return {
      quarter: report.period?.fiscal_quarter?.split(' ')[0] || 'Q1', // Extract Q1, Q2, etc.
      revenue: revenue || 0,
      profit: profit || 0,
      margin: margin || 0,
      growth: growth || 0,
      netIncome: netIncome || 0,
      grossMargin: grossMargin || 0,
      grossProfit: grossProfit || 0,
      operatingCashFlow: operatingCashFlow || 0,
      freeCashFlow: freeCashFlow || 0,
      cashFlowMargin: cashFlowMargin || 0
    };
  } catch (error) {
    console.error('Error extracting financial metrics:', error);
    return null;
  }
}

// Helper function to convert ASCII table to structured format
function convertAsciiToStructured(asciiTable) {
  try {
    const lines = asciiTable.split('\n');
    const sections = [];
    let currentSection = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this is a section header
      if (/^[A-Z\s]+$/.test(trimmedLine) && trimmedLine.length > 3 && !trimmedLine.includes('|')) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmedLine,
          table: []
        };
        continue;
      }
      
      // Check if this line contains table data
      if (line.includes('|') && currentSection) {
        currentSection.table.push(line);
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // If no sections found, treat entire text as one table
    if (sections.length === 0 && asciiTable.includes('|')) {
      sections.push({
        title: 'FINANCIAL DATA',
        table: lines.filter(line => line.includes('|'))
      });
    }
    
    // Convert the first section to structured format
    if (sections.length > 0) {
      const section = sections[0];
      const tableData = parseTableLines(section.table);
      
      if (tableData) {
        return {
          tableData: {
            title: section.title,
            headers: tableData.headers,
            rows: tableData.rows.map(row => ({
              metric: row[0],
              values: row.slice(1)
            }))
          },
          summary: {},
          trends: [],
          highlights: [],
          source: "Financial data analysis"
        };
      }
    }
    
    // Fallback to text if conversion fails
    return {
      tableData: {
        title: "Financial Data",
        headers: ["Data"],
        rows: [{ metric: "Raw Data", values: [asciiTable] }]
      },
      summary: {},
      trends: [],
      highlights: [],
      source: "Financial data analysis"
    };
  } catch (error) {
    console.error('Error converting ASCII table:', error);
    return {
      tableData: {
        title: "Financial Data",
        headers: ["Data"],
        rows: [{ metric: "Raw Data", values: [asciiTable] }]
      },
      summary: {},
      trends: [],
      highlights: [],
      source: "Financial data analysis"
    };
  }
}

// Helper function to parse table lines
function parseTableLines(tableLines) {
  if (!tableLines || tableLines.length < 3) return null;
  
  // Remove separator lines
  const dataLines = tableLines.filter(line => 
    !/^[\s|+\-]+$/.test(line.trim())
  );
  
  if (dataLines.length < 2) return null;
  
  // Parse headers
  const headerLine = dataLines[0];
  const allHeaders = headerLine.split('|').map(cell => cell.trim());
  const headers = allHeaders.filter(header => header && header.trim() !== '');
  
  // Parse data rows
  const rows = dataLines.slice(1).map(line => {
    const allCells = line.split('|').map(cell => cell.trim());
    return allCells.filter(cell => cell && cell.trim() !== '');
  });
  
  // Clean up rows
  const cleanRows = rows.filter(row => 
    row.length > 0 && 
    row.some(cell => cell && cell.trim() !== '') &&
    !row.every(cell => /^[\s\-]+$/.test(cell))
  );
  
  return { headers, rows: cleanRows };
} 