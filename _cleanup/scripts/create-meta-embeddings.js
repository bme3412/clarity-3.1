import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { SparseVectorizer } from '../src/lib/rag/sparseVectorizer.js';

dotenv.config({ path: '.env' });

const TRANSCRIPTS_DIR = path.join(process.cwd(), 'data', 'transcripts');
// Removed the constant COMPANY; we'll extract it dynamically from each JSON file
const CHUNK_SIZE = 1000;
const sparseVectorizer = new SparseVectorizer();

// Mapping for company names to handle different representations
const companyNameMap = {
  'Facebook, Inc. (now Meta Platforms, Inc.)': 'Meta',
  'Meta Platforms, Inc.': 'Meta',
  'Facebook': 'Meta', // Fallback mapping
  // Add other mappings if necessary
};

/**
 * Extracts the current company name from the `company_name` field in the JSON.
 * Falls back to 'Meta' if extraction fails.
 * @param {Object} json - The parsed JSON content of the file.
 * @returns {string} - The standardized company name.
 */
function getCurrentCompanyName(json) {
  const nameField = json.company_name;
  const regex = /\(now\s+([^)]+)\)/i;
  const match = nameField.match(regex);
  let extractedName = match ? match[1].trim() : nameField.split(',')[0].trim();
  // Map to standardized company name
  return companyNameMap[extractedName] || extractedName;
}

/**
 * Reads and parses a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Object|null} - The parsed JSON object or null if an error occurs.
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extracts text sections from QA JSON content.
 * @param {Object} content - The parsed JSON content.
 * @returns {Array<string>} - An array of extracted text sections.
 */
function extractTextFromQA(content) {
  const texts = [];

  // Extract executive responses
  if (content.speakers) {
    for (const [speaker, data] of Object.entries(content.speakers)) {
      // Extract individual responses
      if (data.responses) {
        data.responses.forEach(response => {
          const responseText = [
            `Speaker: ${speaker} (${data.role})`,
            `Topic: ${response.topic}`,
            `Context: ${response.context}`,
            `Response: ${response.content}`
          ].join('\n');
          texts.push(responseText);
        });
      }

      // Extract closing remarks if present
      if (data.closing_remarks) {
        texts.push(`Speaker: ${speaker} (${data.role})\nClosing Remarks: ${data.closing_remarks}`);
      }
    }
  }

  // Extract analyst questions
  if (content.analyst_questions) {
    content.analyst_questions.forEach(qa => {
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

/**
 * Extracts text sections from Earnings JSON content.
 * @param {Object} content - The parsed JSON content.
 * @returns {Array<string>} - An array of extracted text sections.
 */
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

  // Extract Metadata (optional)
  if (content.metadata) {
    const metadataText = extractMetadata(content.metadata);
    texts.push(metadataText);
  }

  return texts;
}

/**
 * Helper function to extract Financials section.
 * @param {Object} financials - The financials object from JSON.
 * @returns {string} - Extracted financials text.
 */
function extractFinancials(financials) {
  let text = 'Financials:\n';

  // Total Revenue
  if (financials.total_revenue) {
    text += `Total Revenue: ${financials.total_revenue.value} ${financials.total_revenue.unit} (${financials.total_revenue.context})\n`;
    text += `Year-over-Year Change: ${financials.total_revenue.year_over_year_change}\n`;
    text += `Constant Currency Growth: ${financials.total_revenue.constant_currency_growth}\n`;
    text += `FX Impact: ${financials.total_revenue.fx_impact}\n`;

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
          text += `    Drivers: ${comp.drivers.join('; ')}\n`;
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
      text += `Key Factor: ${financials.expenses.total_expenses.key_factor}\n`;
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
          text += `    Areas: ${breakdown.areas.join(', ')}\n`;
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
      text += `Impact of Accrual: ${financials.profitability.eps.impact_of_accrual}\n`;
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
    text += `Drivers: ${financials.capital_expenditures.drivers.join(', ')}\n`;
  }

  // Capital Return
  if (financials.capital_return) {
    if (financials.capital_return.share_repurchase) {
      text += `Share Repurchase: ${financials.capital_return.share_repurchase.value} ${financials.capital_return.share_repurchase.unit} (${financials.capital_return.share_repurchase.context})\n`;
    }
  }

  return text;
}

/**
 * Helper function to extract Operating Metrics section.
 * @param {Object} metrics - The operating_metrics object from JSON.
 * @returns {string} - Extracted operating metrics text.
 */
function extractOperatingMetrics(metrics) {
  let text = 'Operating Metrics:\n';

  if (metrics.users) {
    text += 'Users:\n';
    if (metrics.users.facebook_dau) {
      text += `  Facebook DAU: ${metrics.users.facebook_dau.value} ${metrics.users.facebook_dau.unit} (${metrics.users.facebook_dau.year_over_year_change})\n`;
      text += `    Leading Markets: ${metrics.users.facebook_dau.leading_markets}\n`;
    }
    if (metrics.users.facebook_mau) {
      text += `  Facebook MAU: ${metrics.users.facebook_mau.value} ${metrics.users.facebook_mau.unit} (${metrics.users.facebook_mau.year_over_year_change})\n`;
    }
    if (metrics.users.family_metrics) {
      text += '  Family Metrics:\n';
      if (metrics.users.family_metrics.dap) {
        text += `    DAP: ${metrics.users.family_metrics.dap.value} ${metrics.users.family_metrics.dap.unit} (${metrics.users.family_metrics.dap.context})\n`;
      }
      if (metrics.users.family_metrics.map) {
        text += `    MAP: ${metrics.users.family_metrics.map.value} ${metrics.users.family_metrics.map.unit} (${metrics.users.family_metrics.map.context})\n`;
      }
    }
  }

  if (metrics.ad_inventory) {
    text += 'Ad Inventory:\n';
    if (metrics.ad_inventory.ad_impressions) {
      text += `  Ad Impressions: ${metrics.ad_inventory.ad_impressions}\n`;
    }
    if (metrics.ad_inventory.ad_price) {
      text += `  Ad Price: ${metrics.ad_inventory.ad_price}\n`;
    }
  }

  return text;
}

/**
 * Helper function to extract Strategic Updates section.
 * @param {Object} updates - The strategic_updates object from JSON.
 * @returns {string} - Extracted strategic updates text.
 */
function extractStrategicUpdates(updates) {
  let text = 'Strategic Updates:\n';

  // Privacy Focused Vision
  if (updates.privacy_focused_vision) {
    text += '  Privacy Focused Vision:\n';
    text += `    Announced By: ${updates.privacy_focused_vision.announced_by}\n`;
    text += `    Principles: ${updates.privacy_focused_vision.principles.join('; ')}\n`;
    text += `    Business Impact Assessment: ${updates.privacy_focused_vision.business_impact_assessment.join('; ')}\n`;
  }

  // Regulatory Positioning
  if (updates.regulatory_positioning) {
    text += '  Regulatory Positioning:\n';
    text += `    Frameworks Proposed: ${updates.regulatory_positioning.zuckerberg_proposed_frameworks.join('; ')}\n`;
    text += `    Goal: ${updates.regulatory_positioning.goal}\n`;
  }

  // Advertising and Commerce Strategies
  if (updates.advertising_and_commerce_strategies) {
    text += '  Advertising and Commerce Strategies:\n';
    for (const [strategyKey, strategy] of Object.entries(updates.advertising_and_commerce_strategies)) {
      text += `    ${formatKey(strategyKey)}:\n`;
      for (const [detailKey, detailValue] of Object.entries(strategy)) {
        text += `      ${formatKey(detailKey)}: ${detailValue}\n`;
      }
    }
  }

  // Safety and Transparency Initiatives
  if (updates.safety_and_transparency_initiatives) {
    text += '  Safety and Transparency Initiatives:\n';
    for (const [initiativeKey, initiative] of Object.entries(updates.safety_and_transparency_initiatives)) {
      text += `    ${formatKey(initiativeKey)}:\n`;
      if (Array.isArray(initiative)) {
        text += `      - ${initiative.join('\n      - ')}\n`;
      } else if (typeof initiative === 'object') {
        for (const [subKey, subValue] of Object.entries(initiative)) {
          if (Array.isArray(subValue)) {
            text += `      ${formatKey(subKey)}:\n`;
            subValue.forEach(item => {
              text += `        - ${item}\n`;
            });
          } else {
            text += `      ${formatKey(subKey)}: ${subValue}\n`;
          }
        }
      }
    }
  }

  return text;
}

/**
 * Helper function to extract Outlook section.
 * @param {Object} outlook - The outlook object from JSON.
 * @returns {string} - Extracted outlook text.
 */
function extractOutlook(outlook) {
  let text = 'Outlook:\n';

  if (outlook.revenue_growth) {
    text += `  Revenue Growth Expectation: ${outlook.revenue_growth.expectation}\n`;
    text += `  Ad Targeting Headwinds: ${outlook.revenue_growth.ad_targeting_headwinds}\n`;
  }

  if (outlook.expenses_and_investments) {
    text += `  Full Year 2019 Expense Growth: ${outlook.expenses_and_investments.full_year_2019_expense_growth}\n`;
    text += `  Impact of Accrual: ${outlook.expenses_and_investments.impact_of_accrual}\n`;
    text += `  Underlying Trend: ${outlook.expenses_and_investments.underlying_trend}\n`;
  }

  if (outlook.capital_expenditures_guidance) {
    text += `  Capital Expenditures Guidance 2019: ${outlook.capital_expenditures_guidance['2019_range']}\n`;
    text += `  Focus: ${outlook.capital_expenditures_guidance.focus}\n`;
  }

  if (outlook.tax_rate) {
    text += `  Tax Rate: ${outlook.tax_rate}\n`;
  }

  return text;
}

/**
 * Helper function to extract Metadata section.
 * @param {Object} metadata - The metadata object from JSON.
 * @returns {string} - Extracted metadata text.
 */
function extractMetadata(metadata) {
  let text = 'Metadata:\n';
  text += `  Parsed Date: ${metadata.parsed_date}\n`;
  text += `  Company Ticker: ${metadata.company_ticker}\n`;
  text += `  Source: ${metadata.source}\n`;
  text += `  Operating Environment Challenges: ${metadata.operating_environment_challenges.join('; ')}\n`;
  return text;
}

/**
 * Formats keys by replacing underscores with spaces and capitalizing words.
 * @param {string} key - The key to format.
 * @returns {string} - The formatted key.
 */
function formatKey(key) {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Improved chunking strategy that preserves semantic context and strategic discussions.
 * @param {string} text - The text to split.
 * @param {number} maxLength - The maximum length of each chunk.
 * @returns {Array<string>} - An array of semantically meaningful text chunks.
 */
function createSemanticChunks(text, maxLength = 1500) {
  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  
  // Split by major sections first (double line breaks often indicate topic changes)
  const sections = text.split(/\n\s*\n/);
  
  for (const section of sections) {
    if (section.trim().length === 0) continue;
    
    // If section is already within limits, keep it as one chunk
    if (section.length <= maxLength) {
      chunks.push(section.trim());
      continue;
    }
    
    // For longer sections, split by sentences but preserve context
    const sentences = section.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    let currentContext = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const nextSentence = sentences[i + 1];
      // Check if adding this sentence would exceed the limit
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length <= maxLength) {
        currentChunk = potentialChunk;
        // Keep some context for the next chunk
        if (currentChunk.length > maxLength * 0.7) {
          currentContext = sentence;
        }
      } else {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        // Start new chunk with context from previous
        currentChunk = (currentContext ? currentContext + ' ' : '') + sentence;
        currentContext = '';
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  }
  
  return chunks;
}

/**
 * Enhanced text extraction that groups related strategic discussions.
 * @param {Object} content - The parsed JSON content.
 * @returns {Array<string>} - An array of semantically grouped text sections.
 */
function extractStrategicSections(content) {
  const sections = [];
  
  // Extract and group strategic discussions
  if (content.earnings_call) {
    const callText = content.earnings_call;
    
    // Look for strategic discussion patterns
    const strategicPatterns = [
      /(?:strategy|strategic|initiative|focus|priority|investment|partnership|growth|expansion|innovation|transformation)[^.]*(?:\.|$)/gi,
      /(?:AI|artificial intelligence|machine learning|cloud|digital|technology|product|service|market|competitive|leadership)[^.]*(?:\.|$)/gi,
      /(?:revenue|profit|margin|growth|performance|financial|business|segment|division)[^.]*(?:\.|$)/gi
    ];
    
    // Group related strategic discussions
    let strategicSections = [];
    let currentSection = '';
    const sentences = callText.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      const isStrategic = strategicPatterns.some(pattern => pattern.test(sentence));
      
      if (isStrategic) {
        currentSection += (currentSection ? ' ' : '') + sentence;
      } else if (currentSection) {
        // End current strategic section
        strategicSections.push(currentSection.trim());
        currentSection = '';
      }
    }
    
    // Add any remaining strategic section
    if (currentSection.trim()) {
      strategicSections.push(currentSection.trim());
    }
  }
  
  // Add other content sections
  if (content.qa) {
    sections.push(content.qa);
  }
  
  if (content.cfo_commentary) {
    sections.push(content.cfo_commentary);
  }
  
  return sections;
}

/**
 * Splits text into chunks based on sentence boundaries and maximum length.
 * @param {string} text - The text to split.
 * @param {number} maxLength - The maximum length of each chunk.
 * @returns {Array<string>} - An array of text chunks.
 */
function createChunks(text, maxLength = CHUNK_SIZE) {
  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).trim().length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Processes a single JSON file to extract text, create embeddings, and prepare vectors.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Array<Object>} - An array of vectors ready for upsert.
 */
async function processFile(filePath) {
  try {
    const content = await readJsonFile(filePath);
    if (!content) return [];

    const currentCompany = getCurrentCompanyName(content);
    const fiscalYear = content.fiscal_year || '2024';
    const quarter = content.quarter || 'Q1';
    const fileType = path.basename(filePath).includes('_qa.json') ? 'qa' : 'earnings';

    console.log(`Processing ${currentCompany} ${fiscalYear} ${quarter} ${fileType}`);

    // Use enhanced text extraction
    const textSections = extractStrategicSections(content);
    console.log(`Extracted ${textSections.length} strategic sections from ${filePath}`);

    const vectors = [];
    for (let sectionIndex = 0; sectionIndex < textSections.length; sectionIndex++) {
      // Use semantic chunking instead of simple chunking
      const chunks = createSemanticChunks(textSections[sectionIndex]);
      console.log(`Created ${chunks.length} semantic chunks from section ${sectionIndex + 1}`);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const embedding = await openai.embeddings.create({
          input: chunk,
          model: "text-embedding-3-small"
        });

        const sparseValues = sparseVectorizer.toSparseValues(chunk);

        vectors.push({
          id: `${currentCompany}_${fiscalYear}_${quarter}_${fileType}_${sectionIndex}_${chunkIndex}`,
          values: embedding.data[0].embedding,
          ...(sparseValues ? { sparseValues } : {}),
          metadata: {
            text: chunk,
            company: currentCompany,
            fiscal_year: content.fiscal_year,
            quarter: content.quarter,
            type: fileType,
            section: sectionIndex,
            chunk_index: chunkIndex,
            source: path.basename(filePath),
            parsed_date: content.metadata?.parsed_date || '',
            company_ticker: content.metadata?.company_ticker || '',
            // Add semantic metadata for better retrieval
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

/**
 * Upserts vectors into the Pinecone index in batches.
 * @param {Object} index - The Pinecone index object.
 * @param {Array<Object>} vectors - The vectors to upsert.
 * @param {number} batchSize - The number of vectors per batch.
 */
async function upsertVectors(index, vectors, batchSize = 100) {
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`);
  }
}

/**
 * Recursively retrieves all JSON files ending with '_qa.json' or '_earnings.json' from a directory.
 * @param {string} dirPath - The directory path to search.
 * @returns {Array<string>} - An array of file paths.
 */
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

/**
 * Main function to create embeddings for Meta by processing all relevant JSON files.
 */
async function createMetaEmbeddings() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const index = pinecone.index('clarity');
    const companyDir = path.join(TRANSCRIPTS_DIR, 'META'); // Assuming all Meta files are under 'META' directory

    console.log(`\nProcessing META earnings calls...`);
    const jsonFiles = await getJsonFiles(companyDir);
    console.log(`Found ${jsonFiles.length} files`);

    let totalVectors = 0;

    for (const filePath of jsonFiles) {
      console.log(`\nProcessing ${filePath}`);
      const vectors = await processFile(filePath);
      if (vectors.length > 0) {
        await upsertVectors(index, vectors);
        totalVectors += vectors.length;
        console.log(`Created ${vectors.length} vectors from ${filePath}`);
      }
    }

    console.log(`\nAll done! Created ${totalVectors} vectors total for META`);
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

createMetaEmbeddings();
