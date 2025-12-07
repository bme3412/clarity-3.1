import dotenv from 'dotenv';
import fetch from 'node-fetch';

// dotenv.config({ path: '.env' });
import fs from 'fs';
const envConfig = dotenv.parse(fs.readFileSync('.env'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

async function checkModels() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY not found in .env');
    return;
  }

  console.log(`Using API Key: ${apiKey.slice(0, 8)}...`);

  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };

  // 1. Try to list models
  console.log('\n--- Attempting to list models ---');
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', { headers });
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Available models:');
      data.data.forEach(m => console.log(` - ${m.id} (${m.display_name})`));
      return; // Exit if successful
    } else {
      console.error(`❌ Failed to list models: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
    }
  } catch (err) {
    console.error('❌ Network error listing models:', err.message);
  }

  // 2. If listing fails, try a simple completion with a known older model
  const fallbackModel = 'claude-3-sonnet-20240229';
  console.log(`\n--- Testing fallback model: ${fallbackModel} ---`);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: fallbackModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    if (response.ok) {
      console.log(`✅ Success! ${fallbackModel} is working.`);
    } else {
      console.error(`❌ Failed with ${fallbackModel}: ${response.status}`);
      console.error(await response.text());
    }
  } catch (err) {
    console.error(`❌ Error testing ${fallbackModel}:`, err.message);
  }
}

checkModels();

