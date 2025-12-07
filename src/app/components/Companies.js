'use client'; // For Next.js client-side component

import React, { useState } from 'react';

const ExplanationPage = () => {
  // Stores which section’s code is being displayed; null means no modal is open
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(null);

  // Each “cell” has a title, content, and code snippet
  const sections = [
    {
      title: '1. Storing Financial Data',
      content:
        'We store quarterly earnings call transcripts and financial metrics in a vector database. This allows for semantic searches that go beyond simple keywords.',
      code: `
// Example code for storing data in Pinecone
const upsertData = async (documents) => {
  await pineconeIndex.upsert({
    vectors: documents.map(doc => ({
      id: doc.id,
      values: doc.embedding,
      metadata: {
        content: doc.text,
        company: doc.company,
        quarter: doc.quarter,
      },
    }))
  });
};
      `.trim(),
    },
    {
      title: '2. Embedding the Content',
      content:
        'We use Voyage AI’s `voyage-3.5` model to convert each transcript snippet or financial record into numerical embeddings, capturing the semantic meaning of the text.',
      code: `
// Example code for generating embeddings
async function generateEmbedding(text) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Bearer \${process.env.VOYAGE_API_KEY}\`,
    },
    body: JSON.stringify({
      model: 'voyage-3.5',
      input: [text],
      input_type: 'document',
    }),
  });
  const payload = await response.json();
  return payload.data[0].embedding;
}
      `.trim(),
    },
    {
      title: '3. Vector Search',
      content:
        'When a user asks a question, we embed the query and compare it to our stored embeddings in the vector database, finding the most relevant data.',
      code: `
// Example code for Pinecone vector search
const search = async (queryEmbedding) => {
  const response = await pineconeIndex.query({
    vector: queryEmbedding,
    topK: 10,
    includeMetadata: true,
  });
  return response.matches;
};
      `.trim(),
    },
    {
      title: '4. Retrieval-Augmented Generation',
      content:
        'We feed the transcripts returned from the vector search into Anthropic Claude 4.5. Claude then generates a concise, coherent summary based on the real data we found.',
      code: `
// Example code snippet for Claude-based RAG
async function ragPipeline(query) {
  const queryEmbedding = await generateEmbedding(query);
  const docs = await search(queryEmbedding);
  const response = await fetch('https://api.anthropic.com/v1/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: 'claude-4.5-sonnet',
      prompt: \`Human: Summarize the following docs for the question "\${query}"\\nDocs: \${docs.map(d => d.metadata.content).join('\\n')}\\nAssistant:\`,
      temperature: 0.3,
    }),
  });
  const payload = await response.text();
  return payload;
}
      `.trim(),
    },
    {
      title: '5. Multi-Quarter Queries',
      content:
        'Our system detects each quarter or fiscal year mentioned in a question (“Q1 2025 and Q2 2025”) and merges those matches into one final analysis.',
      code: `
// Example code for multiple quarters
function buildQuarterFilter(timeframes) {
  // If multiple quarters found, build an $or query
  return {
    $and: [
      { company: 'AAPL' },
      { $or: timeframes.map(tf => ({ quarter: tf.quarter, fiscalYear: tf.year })) }
    ]
  };
}
      `.trim(),
    },
    {
      title: '6. Financial JSON Integration',
      content:
        'In addition to transcripts, we pull structured financial data (like revenue, EPS) from local JSON files to provide GPT with raw metrics.',
      code: `
// Example code for reading a local JSON file
import fs from 'fs';
import path from 'path';

function readFinancialData(ticker, fy, q) {
  const filePath = path.join(process.cwd(), 'data', 'financials', ticker, \`FY_\${fy}\`, \`Q\${q}\`, \`\${ticker}_FY_\${fy}_Q\${q}.json\`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
      `.trim(),
    },
    {
      title: '7. Final GPT Analysis',
      content:
        'After combining transcripts and data, GPT performs a final pass to create a narrative, highlighting the key metrics and commentary in plain text.',
      code: `
// Example code for final GPT analysis
async function analyzeData(combinedData, intent) {
  const content = combinedData.map(d => d.metadata.text).join('\\n\\n');
  const systemPrompt = \`You are a financial analyst covering \$\{intent.company_name\}...\`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content }
    ],
    temperature: 0.3,
  });
  return response.choices[0].message.content;
}
      `.trim(),
    },
    {
      title: '8. Extending the System',
      content:
        'Thanks to our pipeline approach, adding new documents or even new companies is straightforward. We simply add them to the vector database, update the JSON files if needed, and the entire RAG pipeline automatically incorporates them.',
      code: `
// Example code for extending the system
function addNewCompany(ticker, documents) {
  // 1) embed each doc
  // 2) upsert to Pinecone
  // 3) store any local JSON data
  // 4) system is ready to handle new queries for that ticker
  return "New company integrated successfully!";
}
      `.trim(),
    },
  ];

  // If a cell’s “Show Code” button is clicked, we open the modal with that code
  const openCodeModal = (index) => {
    setSelectedSectionIndex(index);
  };

  // Close the modal
  const closeCodeModal = () => {
    setSelectedSectionIndex(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Heading */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-600 mb-4">
            How Clarity 3.0 Works
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Harnessing vector embeddings, Pinecone, and GPT for targeted
            financial insights
          </p>
        </div>

        {/* 2-Column Grid for Explanation Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-6"
            >
              <h2 className="text-2xl text-blue-400 font-semibold mb-2">
                {section.title}
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                {section.content}
              </p>
              <button
                onClick={() => openCodeModal(idx)}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all"
              >
                Show Code
              </button>
            </div>
          ))}
        </div>

        {/* Modal (Overlay + Box) */}
        {selectedSectionIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="relative bg-gray-800 rounded-lg max-w-3xl w-full p-6 text-gray-200">
              <h3 className="text-xl font-bold mb-4">
                {sections[selectedSectionIndex].title} — Code
              </h3>
              <pre className="whitespace-pre-wrap bg-gray-900 p-4 rounded-md text-sm overflow-auto max-h-96">
                {sections[selectedSectionIndex].code}
              </pre>
              <div className="mt-6 text-right">
                <button
                  onClick={closeCodeModal}
                  className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplanationPage;
