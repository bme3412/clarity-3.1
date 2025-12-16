const fetch = require('node-fetch');

async function testChatAPI() {
  try {
    console.log('Testing chat API...');
    
    const response = await fetch('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'What are Amazon\'s quarterly earnings highlights for 2023?'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Response received, checking stream...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Stream completed successfully!');
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('Received:', data.type, data.content ? data.content.substring(0, 50) + '...' : '');
            
            if (data.type === 'error') {
              console.error('Error received:', data.error);
              return;
            }
            
            if (data.type === 'end') {
              console.log('Stream ended successfully!');
              return;
            }
          } catch (e) {
            // Ignore parsing errors for incomplete data
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testChatAPI(); 