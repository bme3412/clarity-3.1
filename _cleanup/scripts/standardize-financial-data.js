import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standardize financial data structure
async function standardizeFinancialData() {
  const baseDir = path.join(__dirname, '..', 'data', 'financials');
  const companies = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'AMD', 'AVGO', 'CRM', 'ORCL'];
  
  for (const company of companies) {
    console.log(`\nProcessing ${company}...`);
    const companyDir = path.join(baseDir, company);
    
    if (!fs.existsSync(companyDir)) {
      console.log(`  Skipping ${company} - directory not found`);
      continue;
    }
    
    const fiscalYears = fs.readdirSync(companyDir)
      .filter(dir => dir.startsWith('FY_'))
      .sort();
    
    for (const fyDir of fiscalYears) {
      const fiscalYear = fyDir.replace('FY_', '');
      const fyPath = path.join(companyDir, fyDir);
      
      const quarters = fs.readdirSync(fyPath)
        .filter(dir => dir.startsWith('Q'))
        .sort();
      
      for (const qDir of quarters) {
        const quarter = qDir.replace('Q', '');
        const filePath = path.join(fyPath, qDir, `${company}_FY_${fiscalYear}_${qDir}.json`);
        
        if (!fs.existsSync(filePath)) {
          console.log(`  Skipping ${filePath} - file not found`);
          continue;
        }
        
        try {
          console.log(`  Processing ${company} FY${fiscalYear} Q${quarter}...`);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const standardized = standardizeQuarterData(data, company, fiscalYear, quarter);
          
          if (standardized) {
            // Write back the standardized data
            fs.writeFileSync(filePath, JSON.stringify(standardized, null, 2));
            console.log(`    ✓ Standardized ${company} FY${fiscalYear} Q${quarter}`);
          }
        } catch (error) {
          console.error(`    ✗ Error processing ${filePath}:`, error.message);
        }
      }
    }
  }
}

function standardizeQuarterData(data, company, fiscalYear, quarter) {
  const report = data.financial_report;
  if (!report) return null;
  
  let hasChanges = false;
  
  // Check if cash_flow object exists and has the right structure
  if (!report.cash_flow || !report.cash_flow.operating_cash_flow) {
    console.log(`    Adding cash_flow object to ${company} FY${fiscalYear} Q${quarter}`);
    
    // Initialize cash_flow object
    if (!report.cash_flow) {
      report.cash_flow = {};
    }
    
    // Extract operating cash flow from different possible locations
    let operatingCashFlow = 0;
    let capitalExpenditures = 0;
    let freeCashFlow = 0;
    
    // Try to get operating cash flow from cash_flow_from_operations
    if (data.cash_flow?.cash_flow_from_operations?.total_operating_cash_flow?.value) {
      operatingCashFlow = data.cash_flow.cash_flow_from_operations.total_operating_cash_flow.value;
    }
    
    // Try to get operating cash flow from metrics
    if (report.metrics?.key_metrics?.operating_cash_flow_margin?.components?.operating_cash_flow) {
      operatingCashFlow = report.metrics.key_metrics.operating_cash_flow_margin.components.operating_cash_flow;
    }
    
    // Try to get capital expenditures from cash flow from investing
    if (data.cash_flow?.cash_flow_from_investing?.capital_expenditure?.value) {
      capitalExpenditures = data.cash_flow.cash_flow_from_investing.capital_expenditure.value;
    }
    
    // Get free cash flow from the existing structure
    if (report.free_cash_flow?.value) {
      freeCashFlow = report.free_cash_flow.value;
    }
    
    // Add the standardized cash_flow structure
    report.cash_flow = {
      operating_cash_flow: operatingCashFlow,
      capital_expenditures: capitalExpenditures,
      free_cash_flow: freeCashFlow
    };
    
    hasChanges = true;
  }
  
  // Remove the standalone free_cash_flow object if it exists and we've moved it to cash_flow
  if (report.free_cash_flow && report.cash_flow?.free_cash_flow) {
    console.log(`    Removing standalone free_cash_flow from ${company} FY${fiscalYear} Q${quarter}`);
    delete report.free_cash_flow;
    hasChanges = true;
  }
  
  return hasChanges ? data : null;
}

// Run the standardization
standardizeFinancialData()
  .then(() => {
    console.log('\n✅ Financial data standardization complete!');
  })
  .catch((error) => {
    console.error('❌ Error during standardization:', error);
    process.exit(1);
  }); 