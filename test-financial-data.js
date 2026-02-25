import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to extract key metrics from financial JSON
function extractFinancialMetrics(jsonData) {
  try {
    const report = jsonData.financial_report || jsonData.financial_reports?.[0];
    if (!report) return null;
    
    const incomeStatement = report.income_statement;
    if (!incomeStatement) return null;
    
    // Extract revenue - handle different field names
    let revenue = 0;
    if (incomeStatement.revenue?.total?.value) {
      revenue = incomeStatement.revenue.total.value;
    } else if (incomeStatement.net_sales?.total?.value) {
      revenue = incomeStatement.net_sales.total.value;
    } else if (incomeStatement.revenues?.total?.value) {
      revenue = incomeStatement.revenues.total.value;
    }
    
    // Extract operating income - handle different structures
    let profit = 0;
    if (incomeStatement.operating_income?.value) {
      profit = incomeStatement.operating_income.value;
    } else if (incomeStatement.operating_income?.gaap?.value) {
      profit = incomeStatement.operating_income.gaap.value;
    } else if (incomeStatement.operating_income?.non_gaap?.value) {
      profit = incomeStatement.operating_income.non_gaap.value;
    } else if (incomeStatement.margins?.operating_margin?.gaap?.operating_income) {
      // NVDA structure
      profit = incomeStatement.margins.operating_margin.gaap.operating_income;
    } else if (incomeStatement.margins?.operating_margin?.non_gaap?.operating_income) {
      // NVDA non-GAAP structure
      profit = incomeStatement.margins.operating_margin.non_gaap.operating_income;
    }
    
    // Extract margin - handle different structures
    let margin = 0;
    if (incomeStatement.margins?.operating_margin?.current_value) {
      margin = incomeStatement.margins.operating_margin.current_value;
    } else if (incomeStatement.margins?.operating_margin?.gaap?.value) {
      margin = parseFloat(incomeStatement.margins.operating_margin.gaap.value);
    } else if (incomeStatement.margins?.operating_margin?.non_gaap?.value) {
      margin = parseFloat(incomeStatement.margins.operating_margin.non_gaap.value);
    } else if (incomeStatement.operating_margin?.current_value) {
      margin = incomeStatement.operating_margin.current_value;
    } else if (incomeStatement.operating_margin?.value) {
      margin = incomeStatement.operating_margin.value;
    }
    
    // Extract growth - handle different structures
    let growth = 0;
    if (incomeStatement.revenue?.total?.yoy_growth) {
      growth = parseFloat(incomeStatement.revenue.total.yoy_growth);
    } else if (incomeStatement.net_sales?.total?.yoy_growth) {
      growth = incomeStatement.net_sales.total.yoy_growth;
    } else if (incomeStatement.revenues?.total?.yoy_growth) {
      growth = incomeStatement.revenues.total.yoy_growth;
    } else if (incomeStatement.operating_income?.yoy_growth) {
      growth = parseFloat(incomeStatement.operating_income.yoy_growth);
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
    
    // Extract gross margin
    let grossMargin = 0;
    if (incomeStatement.margins?.gross_margin?.current_value) {
      grossMargin = incomeStatement.margins.gross_margin.current_value;
    } else if (incomeStatement.margins?.gross_margin?.gaap?.value) {
      grossMargin = parseFloat(incomeStatement.margins.gross_margin.gaap.value);
    } else if (incomeStatement.margins?.gross_margin?.non_gaap?.value) {
      grossMargin = parseFloat(incomeStatement.margins.gross_margin.non_gaap.value);
    }
    
    // Extract gross profit
    let grossProfit = 0;
    if (incomeStatement.margins?.gross_margin?.gaap?.gross_profit) {
      grossProfit = incomeStatement.margins.gross_margin.gaap.gross_profit;
    } else if (incomeStatement.margins?.gross_margin?.non_gaap?.gross_profit) {
      grossProfit = incomeStatement.margins.gross_margin.non_gaap.gross_profit;
    }
    
    console.log(`[extractFinancialMetrics] Extracted for ${report.period?.fiscal_quarter}:`, {
      revenue,
      profit,
      margin,
      growth,
      netIncome,
      grossMargin,
      grossProfit
    });
    
    return {
      revenue: revenue || 0,
      profit: profit || 0,
      margin: margin || 0,
      growth: growth || 0,
      netIncome: netIncome || 0,
      grossMargin: grossMargin || 0,
      grossProfit: grossProfit || 0
    };
  } catch (error) {
    console.log('Error extracting financial metrics:', error.message);
    return null;
  }
}

// Test function
async function testFinancialData() {
  const companies = ['NVDA']; // Focus on NVDA for debugging
  const fiscalYear = '2023';
  const quarter = 'Q1';
  
  console.log('Testing financial data extraction...\n');
  
  for (const company of companies) {
    try {
      const filePath = path.join(process.cwd(), 'data', 'financials', company, `FY_${fiscalYear}`, quarter, `${company}_FY_${fiscalYear}_${quarter}.json`);
      
      if (fs.existsSync(filePath)) {
        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log(`\n=== ${company} FY${fiscalYear} ${quarter} ===`);
        console.log('Available paths:');
        console.log('- revenue.total.value:', rawData.financial_report?.income_statement?.revenue?.total?.value);
        console.log('- margins.operating_margin.gaap.operating_income:', rawData.financial_report?.income_statement?.margins?.operating_margin?.gaap?.operating_income);
        console.log('- margins.operating_margin.gaap.value:', rawData.financial_report?.income_statement?.margins?.operating_margin?.gaap?.value);
        console.log('- net_income.gaap.value:', rawData.financial_report?.income_statement?.net_income?.gaap?.value);
        console.log('- margins.gross_margin.gaap.value:', rawData.financial_report?.income_statement?.margins?.gross_margin?.gaap?.value);
        console.log('- margins.gross_margin.gaap.gross_profit:', rawData.financial_report?.income_statement?.margins?.gross_margin?.gaap?.gross_profit);
        
        const extractedData = extractFinancialMetrics(rawData);
        
        console.log(`\n${company} FY${fiscalYear} ${quarter}:`);
        console.log(`  Revenue: $${extractedData?.revenue?.toLocaleString()}M`);
        console.log(`  Operating Income: $${extractedData?.profit?.toLocaleString()}M`);
        console.log(`  Operating Margin: ${extractedData?.margin?.toFixed(1)}%`);
        console.log(`  YoY Growth: ${extractedData?.growth?.toFixed(1)}%`);
        console.log(`  Net Income: $${extractedData?.netIncome?.toLocaleString()}M`);
        console.log(`  Gross Margin: ${extractedData?.grossMargin?.toFixed(1)}%`);
        console.log(`  Gross Profit: $${extractedData?.grossProfit?.toLocaleString()}M`);
        console.log('');
      } else {
        console.log(`${company}: File not found at ${filePath}`);
      }
    } catch (error) {
      console.log(`${company}: Error - ${error.message}`);
    }
  }
}

testFinancialData(); 