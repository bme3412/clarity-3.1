import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { COMPANY_NAME_MAP, TARGET_COMPANIES, EMBEDDING_CONFIG } from '../src/config/rag.js';
import { SparseVectorizer } from '../src/lib/rag/sparseVectorizer.js';

// Manually load environment variables before other imports might use them
const envConfig = dotenv.parse(fsSync.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Use local voyage client for scripts (doesn't require TypeScript)
const { embedText } = await import('./lib/voyageClient.js');

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'data', 'transcripts');
const sparseVectorizer = new SparseVectorizer();

// --- Helper functions ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getCurrentCompanyName(json) {
  if (!json || !json.company_name) {
    return 'Unknown';
  }
  
  const nameField = json.company_name;
  const regex = /\(now\s+([^)]+)\)/i;
  const match = nameField.match(regex);
  let extractedName = match ? match[1].trim() : nameField.split(',')[0].trim();
  return COMPANY_NAME_MAP[extractedName] || extractedName;
}

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// --- Universal Text Extraction ---
function extractAllTextRecursively(obj, prefix = '', texts = []) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      extractAllTextRecursively(item, `${prefix}[${index}]`, texts);
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') {
        extractAllTextRecursively(value, prefix ? `${prefix}.${key}` : key, texts);
      } else {
        const stringValue = value === null ? 'null' : String(value);
        texts.push(`${prefix ? prefix + '.' + key : key}: ${stringValue}`);
      }
    }
  } else {
    texts.push(`${prefix}: ${obj}`);
  }
  return texts;
}

function extractTextFromQA(content) {
  const texts = [];
  if (content.speakers) {
    for (const [speaker, data] of Object.entries(content.speakers)) {
      if (data.responses) {
        data.responses.forEach((response) => {
          const responseText = [
            `Speaker: ${speaker} (${data.role})`,
            `Topic: ${response.topic}`,
            `Context: ${response.context}`,
            `Response: ${response.content}`,
          ].join('\n');
          texts.push(responseText);
        });
      }
      if (data.closing_remarks) {
        texts.push(`Speaker: ${speaker} (${data.role})\nClosing Remarks: ${data.closing_remarks}`);
      }
    }
  }
  if (content.analyst_questions) {
    content.analyst_questions.forEach((qa) => {
      const questionText = [
        `Analyst: ${qa.analyst} (${qa.firm})`,
        `Topic: ${qa.topic}`,
        `Question: ${qa.question}`
      ].join('\n');
      texts.push(questionText);
    });
  }
  return texts;
}

function extractTextFromEarnings(content) {
  const texts = [];
  // Extract company and fiscal details
  const companyDetails = [
    `Company: ${content.company_name}`,
    `Fiscal Year: ${content.fiscal_year}`,
    `Quarter: ${content.quarter}`
  ].join('\n');
  texts.push(companyDetails);

  // Extract Financials
  if (content.financials) {
    const financialsText = extractFinancials(content.financials);
    texts.push(financialsText);
  }

  // Extract Operating Metrics
  if (content.operating_metrics) {
    const operatingMetricsText = extractOperatingMetrics(content.operating_metrics);
    texts.push(operatingMetricsText);
  }

  // Extract Strategic Updates
  if (content.strategic_updates) {
    const strategicUpdatesText = extractStrategicUpdates(content.strategic_updates);
    texts.push(strategicUpdatesText);
  }

  // Extract Outlook
  if (content.outlook) {
    const outlookText = extractOutlook(content.outlook);
    texts.push(outlookText);
  }

  // Extract Operating Environment Challenges
  if (content.operating_environment_challenges) {
    const challengesText = extractOperatingEnvironmentChallenges(content.operating_environment_challenges);
    texts.push(challengesText);
  }

  // Extract Metadata (optional)
  if (content.metadata) {
    const metadataText = extractMetadata(content.metadata);
    texts.push(metadataText);
  }

  return texts;
}

function extractFinancials(financials) {
  let text = 'Financials:\n';

  // Total Revenue
  if (financials.total_revenue) {
    text += `Total Revenue: ${financials.total_revenue.value} ${financials.total_revenue.unit} (${financials.total_revenue.context})\n`;
    text += `Year-over-Year Change: ${financials.total_revenue.year_over_year_change}\n`;
    if (financials.total_revenue.constant_currency_growth) {
      text += `Constant Currency Growth: ${financials.total_revenue.constant_currency_growth}\n`;
    }
    if (financials.total_revenue.fx_impact) {
      text += `FX Impact: ${financials.total_revenue.fx_impact}\n`;
    }
    // Composition
    if (financials.total_revenue.composition) {
      text += 'Revenue Composition:\n';
      for (const [key, comp] of Object.entries(financials.total_revenue.composition)) {
        text += `  ${formatKey(key)}: ${comp.value} ${comp.unit}\n`;
        if (comp.year_over_year_change) {
          text += `    Year-over-Year Change: ${comp.year_over_year_change}\n`;
        }
        if (comp.constant_currency_growth) {
          text += `    Constant Currency Growth: ${comp.constant_currency_growth}\n`;
        }
        if (comp.share_of_total_revenue) {
          text += `    Share of Total Revenue: ${comp.share_of_total_revenue}\n`;
        }
        if (comp.drivers) {
          text += `    Drivers: ${comp.drivers.join(';')}\n`;
        }
        if (comp.average_price_per_ad_change) {
          text += `    Average Price Per Ad Change: ${comp.average_price_per_ad_change}\n`;
        }
      }
    }
  }

  // Expenses
  if (financials.expenses) {
    if (financials.expenses.total_expenses) {
      text += `Total Expenses: ${financials.expenses.total_expenses.value} ${financials.expenses.total_expenses.unit} (${financials.expenses.total_expenses.context})\n`;
      text += `Year-over-Year Change: ${financials.expenses.total_expenses.year_over_year_change}\n`;
      if (financials.expenses.total_expenses.key_factor) {
        text += `Key Factor: ${financials.expenses.total_expenses.key_factor}\n`;
      }
    }
    if (financials.expenses.expense_growth_excluding_accrual) {
      text += `Expense Growth Excluding Accrual: ${financials.expenses.expense_growth_excluding_accrual.approximate_growth}\n`;
      text += `Note: ${financials.expenses.expense_growth_excluding_accrual.note}\n`;
    }
    if (financials.expenses.operating_expenses_breakdown) {
      text += 'Operating Expenses Breakdown:\n';
      for (const [key, breakdown] of Object.entries(financials.expenses.operating_expenses_breakdown)) {
        text += `  ${formatKey(key)}:\n`;
        if (breakdown.one_time_accrual) {
          text += `    One-Time Accrual: ${breakdown.one_time_accrual} ${breakdown.unit} (${breakdown.context})\n`;
        }
        if (breakdown.areas) {
          text += `    Areas: ${breakdown.areas.join(',')}\n`;
        }
        if (breakdown.trend) {
          text += `    Trend: ${breakdown.trend}\n`;
        }
        if (breakdown.employees) {
          text += `    Employees: ${breakdown.employees} (${breakdown.year_over_year_change})\n`;
          if (breakdown.context) {
            text += `    Context: ${breakdown.context}\n`;
          }
        }
      }
    }
  }

  // Profitability
  if (financials.profitability) {
    if (financials.profitability.operating_income) {
      text += `Operating Income: ${financials.profitability.operating_income.value} ${financials.profitability.operating_income.unit} (${financials.profitability.operating_income.context})\n`;
      text += `Operating Margin: ${financials.profitability.operating_income.operating_margin}\n`;
    }
    if (financials.profitability.net_income) {
      text += `Net Income: ${financials.profitability.net_income.value} ${financials.profitability.net_income.unit}\n`;
    }
    if (financials.profitability.eps) {
      text += `EPS: ${financials.profitability.eps.value} ${financials.profitability.eps.unit}\n`;
      if (financials.profitability.eps.impact_of_accrual) {
        text += `Impact of Accrual: ${financials.profitability.eps.impact_of_accrual}\n`;
      }
    }
    if (financials.profitability.tax_rate) {
      text += `Tax Rate: ${financials.profitability.tax_rate}\n`;
    }
    if (financials.profitability.cash_flow) {
      text += `Free Cash Flow: ${financials.profitability.cash_flow.free_cash_flow} ${financials.profitability.cash_flow.unit}\n`;
    }
    if (financials.profitability.balance_sheet) {
      text += `Balance Sheet - Cash and Investments: ${financials.profitability.balance_sheet.cash_and_investments} ${financials.profitability.balance_sheet.unit}\n`;
    }
  }

  // Capital Expenditures
  if (financials.capital_expenditures) {
    text += `Capital Expenditures: ${financials.capital_expenditures.value} ${financials.capital_expenditures.unit}\n`;
    if (financials.capital_expenditures.context) {
      text += `Context: ${financials.capital_expenditures.context}\n`;
    }
  }

  return text;
}

function extractOperatingMetrics(metrics) {
  let text = 'Operating Metrics:\n';

  if (metrics.daily_active_users) {
    text += `Daily Active Users: ${metrics.daily_active_users.value} ${metrics.daily_active_users.unit}\n`;
    text += `Year-over-Year Change: ${metrics.daily_active_users.year_over_year_change}\n`;
    if (metrics.daily_active_users.context) {
      text += `Context: ${metrics.daily_active_users.context}\n`;
    }
  }

  if (metrics.monthly_active_users) {
    text += `Monthly Active Users: ${metrics.monthly_active_users.value} ${metrics.monthly_active_users.unit}\n`;
    text += `Year-over-Year Change: ${metrics.monthly_active_users.year_over_year_change}\n`;
    if (metrics.monthly_active_users.context) {
      text += `Context: ${metrics.monthly_active_users.context}\n`;
    }
  }

  if (metrics.family_of_apps) {
    text += 'Family of Apps:\n';
    for (const [app, data] of Object.entries(metrics.family_of_apps)) {
      text += `  ${formatKey(app)}: ${data.value} ${data.unit}\n`;
      if (data.year_over_year_change) {
        text += `    Year-over-Year Change: ${data.year_over_year_change}\n`;
      }
      if (data.context) {
        text += `    Context: ${data.context}\n`;
      }
    }
  }

  if (metrics.ad_impressions) {
    text += `Ad Impressions: ${metrics.ad_impressions.value} ${metrics.ad_impressions.unit}\n`;
    text += `Year-over-Year Change: ${metrics.ad_impressions.year_over_year_change}\n`;
  }

  if (metrics.average_price_per_ad) {
    text += `Average Price Per Ad: ${metrics.average_price_per_ad.value} ${metrics.average_price_per_ad.unit}\n`;
    text += `Year-over-Year Change: ${metrics.average_price_per_ad.year_over_year_change}\n`;
  }

  return text;
}

function extractStrategicUpdates(updates) {
  let text = 'Strategic Updates:\n';

  if (updates.description) {
    text += `Description: ${updates.description}\n`;
  }

  if (updates.initiatives) {
    text += 'Initiatives:\n';
    updates.initiatives.forEach((initiative, index) => {
      text += `  ${index + 1}. ${initiative}\n`;
    });
  }

  if (updates.goals) {
    text += 'Goals:\n';
    updates.goals.forEach((goal, index) => {
      text += `  ${index + 1}. ${goal}\n`;
    });
  }

  if (updates.examples) {
    text += 'Examples:\n';
    updates.examples.forEach((example, index) => {
      text += `  ${index + 1}. ${example}\n`;
    });
  }

  return text;
}

function extractOutlook(outlook) {
  let text = 'Outlook:\n';

  if (outlook.description) {
    text += `Description: ${outlook.description}\n`;
  }

  if (outlook.expectations) {
    text += 'Expectations:\n';
    outlook.expectations.forEach((expectation, index) => {
      text += `  ${index +1}. ${expectation}\n`;
    });
  }

  if (outlook.factors) {
    text += 'Factors:\n';
    outlook.factors.forEach((factor, index) => {
      text += `  ${index + 1} ${factor}\n`;
    });
  }

  return text;
}

function extractOperatingEnvironmentChallenges(challenges) {
  let text = 'Operating Environment Challenges:\n';

  if (challenges.description) {
    text += `Description: ${challenges.description}\n`;
  }

  if (challenges.challenges) {
    text += 'Challenges:\n';
    challenges.challenges.forEach((challenge, index) => {
      text += `  ${index + 1} ${challenge}\n`;
    });
  }

  if (challenges.impacts) {
    text += 'Impacts:\n';
    challenges.impacts.forEach((impact, index) => {
      text += `  ${index + 1} ${impact}\n`;
    });
  }

  return text;
}

function extractMetadata(metadata) {
  let text = 'Metadata:\n';

  if (metadata.parsed_date) {
    text += `Parsed Date: ${metadata.parsed_date}\n`;
  }

  if (metadata.company_ticker) {
    text += `Company Ticker: ${metadata.company_ticker}\n`;
  }

  if (metadata.source) {
    text += `Source: ${metadata.source}\n`;
  }

  return text;
}

function formatKey(key) {
  return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function createSemanticChunks(text, maxLength = 1500) {
  if (!text || typeof text !== 'string') return [];
  const chunks = [];
  const sections = text.split(/\n\s*\n/);
  for (const section of sections) {
    if (section.trim().length === 0) continue;
    if (section.length <= maxLength) {
      chunks.push(section.trim());
      continue;
    }
    const sentences = section.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let currentContext = '';
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
        if (currentChunk.length > maxLength * 0.7) {
          currentContext = sentence;
        }
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = (currentContext ? currentContext + ' ' : '') + sentence;
        currentContext = '';
      }
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }
  return chunks;
}

function extractStrategicSections(content) {
  const sections = [];
  // Handle transcript-style content
  if (typeof content.earnings_call === 'string' && content.earnings_call.trim().length > 0) {
    const callText = content.earnings_call;
    const strategicPatterns = [
      /(?:strategy|strategic|initiative|focus|priority|investment|partnership|growth|expansion|innovation|transformation)[^.]*(?:\.|$)/gi,
      /(?:AI|artificial intelligence|machine learning|cloud|digital|technology|product|service|market|competitive|leadership)[^.]*(?:\.|$)/gi,
      /(?:revenue|profit|margin|growth|performance|financial|business|segment|division)[^.]*(?:\.|$)/gi
    ];
    let strategicSections = [];
    let currentSection = '';
    const sentences = callText.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const isStrategic = strategicPatterns.some(pattern => pattern.test(sentence));
      if (isStrategic) {
        currentSection += (currentSection ? ' ' : '') + sentence;
      } else if (currentSection) {
        strategicSections.push(currentSection.trim());
        currentSection = '';
      }
    }
    if (currentSection.trim()) {
      strategicSections.push(currentSection.trim());
    }
    sections.push(...strategicSections);
  } else if (content.earnings_call) {
    console.warn('earnings_call is not a string:', typeof content.earnings_call, content.earnings_call);
  }
  
  // Handle structured content
  if (content.financials) {
    sections.push(extractFinancials(content.financials));
  }
  if (content.operating_metrics) {
    sections.push(extractOperatingMetrics(content.operating_metrics));
  }
  if (content.strategic_updates) {
    sections.push(extractStrategicUpdates(content.strategic_updates));
  }
  if (content.outlook) {
    sections.push(extractOutlook(content.outlook));
  }
  if (content.operating_environment_challenges) {
    sections.push(extractOperatingEnvironmentChallenges(content.operating_environment_challenges));
  }
  if (content.qa) {
    sections.push(content.qa);
  }
  if (content.cfo_commentary) {
    sections.push(content.cfo_commentary);
  }
  
  // If no structured sections found, extract all text recursively
  if (sections.length === 0) {
    const allTexts = extractAllTextRecursively(content);
    sections.push(...allTexts);
  }
  
  return sections;
}

async function getCompanyDirs(baseDir) {
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => path.join(baseDir, e.name));
}

async function getJsonFiles(dirPath) {
  const files = await fs.readdir(dirPath);
  const jsonFiles = [];
  for (const file of files) {
    if (file.startsWith('.')) continue;
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      jsonFiles.push(...(await getJsonFiles(filePath)));
    } else if (file.endsWith('_qa.json') || file.endsWith('_earnings.json')) {
      jsonFiles.push(filePath);
    }
  }
  return jsonFiles;
}

async function upsertVectors(index, vectors, batchSize = 10) {
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
  }
}

async function processFile(filePath) {
  try {
    const content = await readJsonFile(filePath);
    if (!content) return [];
    // Fallback extraction from path
    const pathParts = filePath.split(path.sep);
    const fiscalYearFromPath = pathParts.find(p => /^FY_\d{4}$/.test(p))?.replace('FY_', '') || '';
    const quarterFromPath = pathParts.find(p => /^Q\d$/.test(p)) || '';
    // Company name fallback: try to get from directory above FY_xxxx
    let companyFromPath = '';
    const fyIdx = pathParts.findIndex(p => /^FY_\d{4}$/.test(p));
    if (fyIdx > 0) companyFromPath = pathParts[fyIdx - 1];
    // Use content or fallback
    const currentCompany = getCurrentCompanyName(content) !== 'Unknown' ? getCurrentCompanyName(content) : companyFromPath;
    const fiscalYear = content.fiscal_year || fiscalYearFromPath;
    const quarter = content.quarter || quarterFromPath;
    const fileType = path.basename(filePath).includes('_qa.json') ? 'qa' : 'earnings';
    
    console.log(`Processing ${currentCompany} ${fiscalYear} ${quarter} ${fileType}`);
    
    // Extract text sections based on file type
    let textSections;
    if (fileType === 'qa') {
      textSections = extractTextFromQA(content);
    } else {
      textSections = extractStrategicSections(content);
    }
    
    console.log(`Extracted ${textSections.length} strategic sections from ${filePath}`);
    
    const vectors = [];
    for (let sectionIndex = 0; sectionIndex < textSections.length; sectionIndex++) {
      const chunks = createSemanticChunks(textSections[sectionIndex]);
      console.log(`Created ${chunks.length} semantic chunks from section ${sectionIndex + 1}`);
      
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      
      console.log(`Waiting ${EMBEDDING_CONFIG.rateLimitDelay / 1000}s to respect Voyage AI free tier rate limits...`);
      await sleep(EMBEDDING_CONFIG.rateLimitDelay); 

      let embedding;
      try {
        embedding = await embedText(chunk);
      } catch (err) {
        console.error(`Failed to embed chunk ${chunkIndex} of section ${sectionIndex}:`, err.message);
        continue;
      }
      
      const sparseValues = sparseVectorizer.toSparseValues(chunk);

      // Extract ticker from directory path (e.g., /data/transcripts/AMZN/FY_2024/...)
      const tickerFromPath = pathParts.find((p, i) => 
        pathParts[i + 1]?.startsWith('FY_') && /^[A-Z]{2,5}$/.test(p)
      ) || '';
      
      vectors.push({
      id: `${tickerFromPath || currentCompany}_${fiscalYear}_${quarter}_${fileType}_${sectionIndex}_${chunkIndex}`,
      values: embedding,
      ...(sparseValues ? { sparseValues } : {}),
      metadata: {
        text: chunk,
        company: currentCompany,
        ticker: tickerFromPath || content.metadata?.company_ticker || '', // Primary ticker field
        company_ticker: content.metadata?.company_ticker || tickerFromPath || '', // Legacy field
        fiscal_year: fiscalYear,
        quarter: quarter,
        type: fileType,
        section: sectionIndex,
        chunk_index: chunkIndex,
        source: path.basename(filePath),
        parsed_date: content.metadata?.parsed_date || '',
        is_strategic: /strategy|strategic|initiative|focus|priority|investment|partnership|growth|expansion|innovation|transformation/i.test(chunk),
        has_metrics: /revenue|profit|margin|growth|performance|financial|business|segment|division/i.test(chunk),
        has_ai_tech: /AI|artificial intelligence|machine learning|cloud|digital|technology|product|service/i.test(chunk)
      }
    });
  }
    }
    return vectors;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return [];
  }
}

// --- Main universal embedding script ---
async function createAllEmbeddings() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
    const indexName = process.env.PINECONE_INDEX || 'clarity';
    console.log(`Connecting to Pinecone index: ${indexName}`);
    const index = pinecone.index(indexName);
    const companyDirs = await getCompanyDirs(TRANSCRIPTS_DIR);
    let totalVectors = 0;
    
    // Filter for specific companies to speed up initial setup
    const targetCompanies = TARGET_COMPANIES;
    const filteredDirs = companyDirs.filter(dir => targetCompanies.includes(path.basename(dir)));
    
    for (const companyDir of filteredDirs) {
      const companyName = path.basename(companyDir);
      console.log(`\nProcessing transcripts for ${companyName}...`);
      const jsonFiles = await getJsonFiles(companyDir);
      
      // Filter for only the most recent data (FY2024 Q3) to save time/tokens
      const recentFiles = jsonFiles.filter(f => f.includes('FY_2024') && f.includes('Q3'));
      console.log(`Found ${jsonFiles.length} files for ${companyName}, filtering to ${recentFiles.length} recent files (FY2024 Q3)`);
      
      for (const filePath of recentFiles) {
        console.log(`\nProcessing ${filePath}`);
        const vectors = await processFile(filePath);
        if (vectors.length > 0) {
          await upsertVectors(index, vectors);
          totalVectors += vectors.length;
          console.log(`Created ${vectors.length} vectors from ${filePath}`);
        }
      }
    }
    
    console.log(`\nAll done! Created ${totalVectors} vectors total for all companies.`);
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

createAllEmbeddings(); 