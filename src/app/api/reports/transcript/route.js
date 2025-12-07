import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load and structure transcript data for interactive viewing
function loadTranscriptData(ticker, fiscalYear, quarter) {
  const basePath = path.join(process.cwd(), 'data', 'transcripts', ticker, `FY_${fiscalYear}`, quarter);
  const parsedPath = path.join(basePath, 'parsed_earnings');
  
  const earningsFile = path.join(parsedPath, `${ticker}_FY${fiscalYear}_${quarter}_earnings.json`);
  const qaFile = path.join(parsedPath, `${ticker}_FY${fiscalYear}_${quarter}_qa.json`);
  const earningsFileAlt = path.join(parsedPath, `${ticker}_FY_${fiscalYear}_${quarter}_earnings.json`);
  const qaFileAlt = path.join(parsedPath, `${ticker}_FY_${fiscalYear}_${quarter}_qa.json`);
  
  let earnings = null;
  let qa = null;
  let rawTranscript = null;
  
  for (const file of [earningsFile, earningsFileAlt]) {
    if (fs.existsSync(file)) {
      try {
        earnings = JSON.parse(fs.readFileSync(file, 'utf8'));
        break;
      } catch (e) {}
    }
  }
  
  for (const file of [qaFile, qaFileAlt]) {
    if (fs.existsSync(file)) {
      try {
        qa = JSON.parse(fs.readFileSync(file, 'utf8'));
        break;
      } catch (e) {}
    }
  }
  
  // Load raw transcript from .txt file
  // Search in both the base path and parsed_earnings subfolder
  const searchDirs = [basePath, parsedPath];
  
  for (const searchDir of searchDirs) {
    if (rawTranscript) break;
    if (!fs.existsSync(searchDir)) continue;
    
    try {
      const files = fs.readdirSync(searchDir);
      for (const file of files) {
        if (file.toLowerCase().includes('transcript') && file.endsWith('.txt')) {
          const filePath = path.join(searchDir, file);
          rawTranscript = fs.readFileSync(filePath, 'utf8');
          break;
        }
      }
    } catch (e) {}
  }
  
  return { earnings, qa, rawTranscript };
}

// Extract structured sections from transcript for interactive display
function structureTranscript(earnings, qa) {
  const sections = [];
  
  // Add executive comments from earnings
  if (earnings?.executive_comments) {
    if (earnings.executive_comments.ceo_statement) {
      sections.push({
        id: 'ceo-statement',
        type: 'prepared_remarks',
        speaker: 'CEO',
        speakerRole: 'Chief Executive Officer',
        title: 'CEO Opening Remarks',
        content: earnings.executive_comments.ceo_statement,
        topics: detectTopics(earnings.executive_comments.ceo_statement),
        sentiment: detectSentiment(earnings.executive_comments.ceo_statement)
      });
    }
    if (earnings.executive_comments.cfo_statement) {
      sections.push({
        id: 'cfo-statement',
        type: 'prepared_remarks',
        speaker: 'CFO',
        speakerRole: 'Chief Financial Officer',
        title: 'CFO Financial Review',
        content: earnings.executive_comments.cfo_statement,
        topics: detectTopics(earnings.executive_comments.cfo_statement),
        sentiment: detectSentiment(earnings.executive_comments.cfo_statement)
      });
    }
  }
  
  // Add financial highlights as a section
  if (earnings?.financials) {
    const highlights = formatFinancialHighlights(earnings.financials);
    if (highlights) {
      sections.push({
        id: 'financial-highlights',
        type: 'financial_data',
        speaker: 'Financial Data',
        speakerRole: 'Structured Data',
        title: 'Key Financial Metrics',
        content: highlights,
        topics: ['revenue', 'earnings', 'margins', 'guidance'],
        sentiment: 'neutral',
        isStructured: true,
        rawData: earnings.financials
      });
    }
  }
  
  // Add Q&A sections
  if (qa?.speakers) {
    for (const [speakerKey, speakerData] of Object.entries(qa.speakers)) {
      if (speakerData.responses && speakerData.responses.length > 0) {
        speakerData.responses.forEach((response, idx) => {
          sections.push({
            id: `qa-${speakerKey}-${idx}`,
            type: 'qa_response',
            speaker: formatSpeakerName(speakerKey),
            speakerRole: speakerData.role || 'Executive',
            title: response.topic || 'Q&A Response',
            content: response.content,
            topics: detectTopics(response.content),
            sentiment: detectSentiment(response.content)
          });
        });
      }
    }
  }
  
  // Add analyst questions
  if (qa?.analyst_questions) {
    qa.analyst_questions.forEach((question, idx) => {
      const questionText = question.questions?.join('\n\n') || '';
      if (questionText) {
        sections.push({
          id: `analyst-q-${idx}`,
          type: 'analyst_question',
          speaker: question.analyst || 'Analyst',
          speakerRole: question.firm || 'Wall Street',
          title: question.topics?.join(', ') || 'Analyst Question',
          content: questionText,
          topics: question.topics || detectTopics(questionText),
          sentiment: 'neutral',
          firm: question.firm
        });
      }
    });
  }
  
  return sections;
}

function formatSpeakerName(key) {
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatFinancialHighlights(financials) {
  const highlights = [];
  
  if (financials.total_revenue) {
    highlights.push(`Total Revenue: $${financials.total_revenue.value}B (${financials.total_revenue.year_over_year_change} YoY)`);
  }
  
  if (financials.total_revenue?.composition) {
    for (const [segment, data] of Object.entries(financials.total_revenue.composition)) {
      if (data.value) {
        highlights.push(`• ${segment.replace(/_/g, ' ').toUpperCase()}: $${data.value}B (${data.year_over_year_change} YoY)`);
      }
    }
  }
  
  if (financials.profitability?.eps) {
    highlights.push(`EPS: $${financials.profitability.eps.value} (${financials.profitability.eps.year_over_year_change} YoY)`);
  }
  
  if (financials.guidance?.fourth_quarter_2024?.revenue) {
    const g = financials.guidance.fourth_quarter_2024.revenue;
    highlights.push(`Q4 Revenue Guidance: $${g.value}B ±${g.range}B`);
  }
  
  return highlights.join('\n');
}

// Topic detection based on keywords
function detectTopics(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const topics = [];
  
  const topicKeywords = {
    'ai': ['ai', 'artificial intelligence', 'machine learning', 'neural', 'llm', 'generative'],
    'revenue': ['revenue', 'sales', 'top line', 'growth'],
    'data_center': ['data center', 'datacenter', 'cloud', 'server', 'infrastructure'],
    'margins': ['margin', 'gross margin', 'operating margin', 'profitability'],
    'guidance': ['guidance', 'outlook', 'expect', 'forecast', 'anticipate'],
    'competition': ['competitor', 'market share', 'competitive', 'versus'],
    'supply_chain': ['supply', 'inventory', 'capacity', 'manufacturing'],
    'products': ['product', 'launch', 'roadmap', 'generation', 'chip'],
    'customers': ['customer', 'adoption', 'deployment', 'partner'],
    'risk': ['risk', 'challenge', 'headwind', 'concern', 'uncertainty']
  };
  
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      topics.push(topic);
    }
  }
  
  return topics;
}

// Simple sentiment detection
function detectSentiment(text) {
  if (!text) return 'neutral';
  const lower = text.toLowerCase();
  
  const positiveWords = ['strong', 'record', 'exceed', 'growth', 'opportunity', 'confident', 'pleased', 'impressive', 'momentum'];
  const negativeWords = ['decline', 'challenge', 'headwind', 'concern', 'uncertain', 'weak', 'pressure', 'difficult'];
  
  let score = 0;
  positiveWords.forEach(w => { if (lower.includes(w)) score++; });
  negativeWords.forEach(w => { if (lower.includes(w)) score--; });
  
  if (score >= 2) return 'positive';
  if (score <= -2) return 'negative';
  return 'neutral';
}

// Parse raw transcript into speaker-based sections
function parseRawTranscript(rawText) {
  if (!rawText) return [];
  
  const sections = [];
  const lines = rawText.split('\n');
  let currentSpeaker = null;
  let currentRole = null;
  let currentContent = [];
  let sectionIndex = 0;
  
  // Common speaker patterns like "LISA SU:", "CEO:", "ANALYST:", etc.
  const speakerPattern = /^([A-Z][A-Z\s\.']+):\s*/;
  
  const roleMap = {
    'CEO': 'Chief Executive Officer',
    'CFO': 'Chief Financial Officer',
    'CTO': 'Chief Technology Officer',
    'COO': 'Chief Operating Officer',
    'MODERATOR': 'Call Moderator',
    'OPERATOR': 'Call Operator',
  };
  
  for (const line of lines) {
    const match = line.match(speakerPattern);
    
    if (match) {
      // Save previous section
      if (currentSpeaker && currentContent.length > 0) {
        const content = currentContent.join('\n').trim();
        if (content) {
          const isAnalyst = currentSpeaker.toLowerCase().includes('analyst') || 
                           currentContent.join(' ').includes('question') ||
                           currentContent.join(' ').includes('?');
          
          sections.push({
            id: `raw-${sectionIndex++}`,
            type: isAnalyst ? 'analyst_question' : 'prepared_remarks',
            speaker: formatSpeakerName(currentSpeaker),
            speakerRole: currentRole || 'Executive',
            title: content.substring(0, 60) + (content.length > 60 ? '...' : ''),
            content: content,
            topics: detectTopics(content),
            sentiment: detectSentiment(content)
          });
        }
      }
      
      // Start new section
      currentSpeaker = match[1].trim();
      currentRole = roleMap[currentSpeaker] || null;
      currentContent = [line.replace(speakerPattern, '')];
    } else if (currentSpeaker) {
      currentContent.push(line);
    } else if (line.trim()) {
      // First lines before any speaker - often the title/intro
      if (sections.length === 0 && line.trim().length > 10) {
        sections.push({
          id: `raw-header-${sectionIndex++}`,
          type: 'prepared_remarks',
          speaker: 'Call Introduction',
          speakerRole: 'Header',
          title: 'Call Header',
          content: line.trim(),
          topics: [],
          sentiment: 'neutral'
        });
      }
    }
  }
  
  // Don't forget the last section
  if (currentSpeaker && currentContent.length > 0) {
    const content = currentContent.join('\n').trim();
    if (content) {
      sections.push({
        id: `raw-${sectionIndex++}`,
        type: 'prepared_remarks',
        speaker: formatSpeakerName(currentSpeaker),
        speakerRole: currentRole || 'Executive',
        title: content.substring(0, 60) + (content.length > 60 ? '...' : ''),
        content: content,
        topics: detectTopics(content),
        sentiment: detectSentiment(content)
      });
    }
  }
  
  return sections;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get('ticker');
  const fiscalYear = searchParams.get('fiscalYear');
  const quarter = searchParams.get('quarter');
  
  if (!ticker || !fiscalYear || !quarter) {
    return NextResponse.json(
      { error: 'ticker, fiscalYear, and quarter are required' },
      { status: 400 }
    );
  }
  
  const normalizedTicker = ticker.toUpperCase();
  const normalizedQuarter = quarter.toUpperCase();
  
  const { earnings, qa, rawTranscript } = loadTranscriptData(normalizedTicker, fiscalYear, normalizedQuarter);
  
  // If we have no data at all, return error
  if (!earnings && !qa && !rawTranscript) {
    return NextResponse.json(
      { error: `No transcript data found for ${normalizedTicker} ${normalizedQuarter} FY${fiscalYear}` },
      { status: 404 }
    );
  }
  
  // Build sections from structured data first, fall back to raw transcript parsing
  let sections = structureTranscript(earnings, qa);
  
  // If we have raw transcript but no structured sections, parse the raw transcript
  if (sections.length === 0 && rawTranscript) {
    sections = parseRawTranscript(rawTranscript);
  }
  
  // Extract unique values for filters
  const speakers = [...new Set(sections.map(s => s.speaker))];
  const types = [...new Set(sections.map(s => s.type))];
  const allTopics = [...new Set(sections.flatMap(s => s.topics))];
  
  return NextResponse.json({
    ticker: normalizedTicker,
    fiscalYear,
    quarter: normalizedQuarter,
    sections,
    rawTranscript: rawTranscript || null,
    filters: {
      speakers,
      types,
      topics: allTopics
    },
    metadata: {
      sectionCount: sections.length,
      hasEarnings: !!earnings,
      hasQA: !!qa,
      hasRawTranscript: !!rawTranscript
    }
  });
}

