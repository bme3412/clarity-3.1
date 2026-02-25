# 🎯 High-Value RAG Use Cases for Investment Professionals

## The Problem with Simple Q&A

"What was AMD's Q3 revenue?" is **low-value** because:
1. Any terminal or 10-Q gives you that instantly
2. It doesn't require RAG or LLMs
3. No investment professional would pay for this

## What Investment Professionals Actually Need

Investment professionals need **synthesized insights** that would take hours to compile manually:
- Cross-quarter trend analysis
- Competitive positioning assessments  
- Management credibility tracking (guidance vs actuals)
- Theme extraction across multiple earnings calls
- Risk factor monitoring
- Analyst sentiment synthesis

---

## 📊 High-Value Report Types

### 1. **Earnings Digest** (Post-Earnings Summary)
**Trigger:** Automatically after each earnings call
**Value:** Saves 2-3 hours of transcript reading per company

```
PROMPT TEMPLATE:
───────────────
You are a senior equity research analyst. Generate a concise earnings digest for {COMPANY} {QUARTER} {YEAR}.

Based on the earnings call transcript and financial data provided:

1. **HEADLINE** (1 sentence): The single most important takeaway
2. **KEY METRICS** (table): Revenue, EPS, Guidance vs Consensus, Segment performance
3. **MANAGEMENT TONE**: Bullish/Neutral/Cautious - with supporting quote
4. **STRATEGIC SHIFTS**: Any changes in strategy, capital allocation, or priorities
5. **GUIDANCE CHANGES**: What changed from last quarter's outlook
6. **ANALYST CONCERNS**: Top 3 topics analysts pushed back on
7. **RISKS FLAGGED**: New or elevated risks mentioned by management

Context: {EARNINGS_TRANSCRIPT} {FINANCIAL_DATA}
```

**Evaluation Metrics:**
- Faithfulness: Every claim must map to source
- Completeness: Did it catch the top 5 themes from Q&A?
- Accuracy: Are all numbers correct?

---

### 2. **Competitive Intelligence Brief**
**Trigger:** On-demand comparison of 2-3 companies
**Value:** Normally requires reading 6+ earnings calls

```
PROMPT TEMPLATE:
───────────────
You are a competitive intelligence analyst covering the semiconductor industry.

Compare {COMPANY_A} and {COMPANY_B} on the dimension of: {DIMENSION}

Dimensions can be:
- AI/Data Center Strategy
- Revenue Growth Trajectory
- Margin Profile & Profitability
- Capital Allocation Philosophy
- Management Execution (Guidance vs Actuals)
- Customer Concentration Risk

For each company, extract:
1. **Current Position**: Where they stand today
2. **Strategic Direction**: Where management says they're heading
3. **Key Metrics**: Relevant quantitative data
4. **Management Quote**: Most revealing statement on this topic
5. **Analyst Skepticism**: What concerns were raised

Then provide:
- **Head-to-Head Assessment**: Who has the advantage and why
- **Key Differentiators**: What separates them
- **Watch Points**: What to monitor going forward

Context: {COMPANY_A_TRANSCRIPTS} {COMPANY_B_TRANSCRIPTS} {FINANCIAL_DATA}
```

**Example Query:**
"Compare AMD and NVIDIA on AI Data Center strategy using the last 4 quarters of earnings"

---

### 3. **Guidance Tracker**
**Trigger:** Track management credibility over time
**Value:** Surfaces patterns in management's forecasting accuracy

```
PROMPT TEMPLATE:
───────────────
Analyze {COMPANY}'s guidance accuracy over the past {N} quarters.

For each quarter, extract:
1. **Revenue Guidance Given**: What they guided
2. **Actual Revenue**: What they delivered
3. **Beat/Miss**: Amount and percentage
4. **Explanation**: How management explained any variance
5. **Revised Outlook**: How guidance changed quarter-over-quarter

Create a table showing:
| Quarter | Guided | Actual | Variance | Management Explanation |

Then assess:
- **Credibility Score**: Are they consistent sandbagging? Overpromising?
- **Pattern Recognition**: Any systematic bias?
- **Red Flags**: Quarters where explanation doesn't match reality

Context: {MULTI_QUARTER_TRANSCRIPTS} {FINANCIAL_DATA}
```

---

### 4. **Theme Tracker** (Cross-Company Analysis)
**Trigger:** Track a specific theme across all covered companies
**Value:** See the full industry picture on a topic

```
PROMPT TEMPLATE:
───────────────
Track the theme of "{THEME}" across all covered companies for {QUARTER} {YEAR}.

Theme examples:
- "AI Infrastructure Investment"
- "Customer Inventory Digestion"
- "Gross Margin Pressure"
- "China Exposure"
- "Capital Expenditure Plans"

For each company, extract:
1. **Exposure Level**: High/Medium/Low/None
2. **Management Stance**: Bullish/Cautious/Concerned
3. **Key Quote**: Most relevant management statement
4. **Quantitative Data**: Any numbers mentioned
5. **QoQ Change**: How has their stance evolved?

Then synthesize:
- **Industry-Wide Assessment**: What's the consensus view?
- **Outliers**: Who's diverging from the pack and why?
- **Leading Indicators**: Who's seeing this first?

Context: {ALL_COMPANY_TRANSCRIPTS_FOR_QUARTER}
```

**Example:**
"Track 'AI Data Center Demand' across AMD, NVDA, AVGO, GOOGL for Q3 2024"

---

### 5. **Management Sentiment Analyzer**
**Trigger:** Detect tone shifts that precede stock moves
**Value:** Early warning system for fundamental changes

```
PROMPT TEMPLATE:
───────────────
Analyze management sentiment evolution for {COMPANY} over the past {N} quarters.

For each quarter's earnings call, assess:
1. **Overall Tone**: 1-10 scale (1=defensive, 10=confident)
2. **Key Tone Indicators**: Language patterns observed
3. **Topic-Specific Sentiment**:
   - Revenue outlook: Optimistic/Neutral/Cautious
   - Competitive position: Strong/Stable/Challenged
   - Macro environment: Favorable/Uncertain/Hostile
4. **Hedge Words**: Frequency of "uncertain," "challenging," "volatility"
5. **Forward-Looking Confidence**: Strong/Moderate/Weak

Highlight:
- **Sentiment Shifts**: Where did tone change significantly?
- **Divergence**: Where tone doesn't match numbers
- **Warning Signs**: Defensive language, blame-shifting, vague answers

Context: {MULTI_QUARTER_TRANSCRIPTS}
```

---

### 6. **Analyst Question Analyzer**
**Trigger:** Understand what smart money is focused on
**Value:** See the questions before you think to ask them

```
PROMPT TEMPLATE:
───────────────
Analyze analyst questions from {COMPANY}'s {QUARTER} {YEAR} earnings call.

Categorize all questions by:
1. **Topic Cluster**: Group similar questions
2. **Question Sentiment**: Bullish probing / Bearish skepticism / Neutral clarification
3. **Follow-Up Persistence**: Did they push back on answers?
4. **Firm Distribution**: Which firms asked what

Then identify:
- **Hot Topics**: What got the most airtime?
- **Unanswered Concerns**: What did management dodge?
- **Consensus Worry**: What are multiple analysts asking about?
- **Contrarian Questions**: Interesting angles most missed

Also track:
- **New Topics**: Questions that weren't asked last quarter
- **Dropped Topics**: What stopped being asked

Context: {QA_TRANSCRIPT}
```

---

### 7. **Risk Monitor Dashboard**
**Trigger:** Continuous monitoring for risk factor changes
**Value:** Systematic tracking of what could go wrong

```
PROMPT TEMPLATE:
───────────────
Extract and categorize risk factors from {COMPANY}'s {QUARTER} {YEAR} earnings.

Risk Categories:
1. **Operational**: Supply chain, execution, capacity
2. **Competitive**: Market share, pricing pressure, new entrants
3. **Macro**: Demand environment, currency, rates
4. **Regulatory**: Antitrust, export controls, compliance
5. **Customer**: Concentration, inventory, demand shifts
6. **Technology**: Product transitions, R&D execution

For each risk mentioned:
- **Description**: What is the risk?
- **Severity**: Management's implied concern level (High/Medium/Low)
- **Mitigation**: What are they doing about it?
- **Timeline**: Near-term or long-term concern?
- **Source**: Direct quote from management

Then provide:
- **New Risks**: First time mentioned
- **Elevated Risks**: Increased emphasis vs last quarter
- **Diminished Risks**: Less concern than before
- **Unaddressed Risks**: Obvious concerns management didn't mention

Context: {EARNINGS_TRANSCRIPT}
```

---

### 8. **Investment Thesis Validator**
**Trigger:** Test a specific thesis against transcript evidence
**Value:** Forces disciplined, evidence-based investing

```
PROMPT TEMPLATE:
───────────────
You are a skeptical investment analyst. The user has a thesis about {COMPANY}.

THESIS: "{USER_THESIS}"

Your job is to:

1. **SUPPORTING EVIDENCE**: Find quotes and data that support this thesis
   - Direct quotes from management
   - Quantitative data that backs the thesis
   - Analyst questions that validate the narrative

2. **CONTRADICTING EVIDENCE**: Find quotes and data that challenge this thesis
   - Management statements that conflict
   - Data that undermines the thesis
   - Risks that could derail the thesis

3. **GAPS IN EVIDENCE**: What would you need to know that isn't in the transcripts?

4. **THESIS STRENGTH RATING**: 1-10 with explanation
   - 1-3: Weak, evidence doesn't support
   - 4-6: Mixed, needs more confirmation
   - 7-10: Strong, well-supported by evidence

Be adversarial. Your job is to stress-test, not validate.

Context: {MULTI_QUARTER_TRANSCRIPTS} {FINANCIAL_DATA}
```

**Example:**
"Test the thesis: 'AMD will capture 30% of the AI GPU market by 2026'"

---

## 🔧 Implementation Priority

| Report Type | Complexity | User Value | Build Order |
|-------------|-----------|------------|-------------|
| Earnings Digest | Medium | Very High | 1 |
| Risk Monitor | Low | High | 2 |
| Analyst Question Analyzer | Low | High | 3 |
| Competitive Intelligence | High | Very High | 4 |
| Guidance Tracker | Medium | High | 5 |
| Theme Tracker | High | Very High | 6 |
| Sentiment Analyzer | Medium | Medium | 7 |
| Thesis Validator | High | Very High | 8 |

---

## 📏 Evaluation Framework

### Quantitative Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| **Faithfulness** | % of claims that can be traced to source | >95% |
| **Completeness** | % of key topics covered vs human baseline | >85% |
| **Accuracy** | % of numbers/dates correct | 100% |
| **Relevance** | % of output directly addressing the query | >90% |

### Qualitative Evaluation

For each report type, create a rubric:

```
EARNINGS DIGEST RUBRIC:
───────────────────────
□ Headline captures the most important takeaway
□ All segment revenues mentioned
□ Guidance comparison to consensus included
□ At least one management quote included
□ Top 3 analyst concerns identified
□ No hallucinated numbers
□ Appropriate length (300-500 words)
```

### A/B Testing

Run same query with different:
1. Retrieval strategies (dense vs hybrid vs hyde vs multi-query)
2. Chunk sizes
3. Number of retrieved chunks
4. Prompt variations

Track which combinations produce highest-rated outputs.

---

## 🚀 Quick Wins to Implement

### 1. Earnings Digest Button
Add a "Generate Digest" button that:
- Takes company + quarter as input
- Retrieves all relevant chunks for that period
- Uses the Earnings Digest prompt template
- Outputs a structured summary

### 2. Pre-Built Comparisons
Dropdown for common comparisons:
- "AMD vs NVDA: Data Center"
- "AAPL vs GOOGL: Services Revenue"
- "MSFT vs AMZN: Cloud Growth"

### 3. Risk Alert System
Background job that:
- Runs Risk Monitor on each new earnings
- Flags new or elevated risks
- Sends notification/email

---

## 📊 Data Gaps to Address

Based on the current embeddings, we're missing:

1. **Consensus Estimates**: Need to add analyst estimates to compare guidance
2. **Stock Price Data**: To correlate sentiment with price moves
3. **Peer Financials**: To enable true competitive comparisons
4. **Historical Guidance**: To build the guidance tracker baseline
5. **Industry Reports**: Gartner/IDC market size data for context

---

## Next Steps

1. **Pick one report type** (recommend: Earnings Digest)
2. **Build a dedicated API endpoint** that implements it
3. **Create evaluation dataset** (5-10 test cases with human-graded outputs)
4. **Iterate on prompt** until quality is consistently high
5. **Add to UI** as a premium feature
6. **Repeat for next report type**

The goal is to move from "ask anything" to "get structured, actionable intelligence."

