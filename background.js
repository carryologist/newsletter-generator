// Background service worker for Newsletter Generator

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Newsletter Generator extension installed');
  
  // Initialize default categories
  chrome.storage.sync.get(['categories'], (result) => {
    if (!result.categories) {
      const defaultCategories = [
        'Employee Milestones',
        'Customer Wins',
        'Product Announcements',
        'Company News',
        'Industry Updates',
        'Team Updates'
      ];
      chrome.storage.sync.set({ categories: defaultCategories });
    }
  });
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-content') {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        // Send message to content script to capture selected text
        chrome.tabs.sendMessage(tabs[0].id, { action: 'captureSelection' });
      }
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processContent') {
    processContentWithAI(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Process content with OpenAI API
async function processContentWithAI(contentData) {
  try {
    // Get API key from storage
    const { openaiApiKey } = await chrome.storage.sync.get(['openaiApiKey']);
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in the extension options.');
    }
    
    // Get current categories
    const { categories } = await chrome.storage.sync.get(['categories']);
    
    const prompt = `
Analyze the following content and create a contextual newsletter summary:

Content: "${contentData.selectedText}"
Source URL: ${contentData.sourceUrl}

Tasks:
1. Extract the author name from the content if mentioned (use "the author" if not found)
2. Determine the content type (post, article, update, announcement, milestone, etc.)
3. Clean up the domain name (e.g. "medium.com" → "Medium", "linkedin.com" → "LinkedIn")
4. Create a summary using this format: "This [content-type] from [clean-domain] describes how [author] [summary]"
5. Categorize using one of these categories: ${categories.join(', ')}
6. If none fit well, suggest a new category

Respond in JSON format:
{
  "summary": "This [content-type] from [clean-domain] describes how [author] [summary]",
  "category": "Selected or suggested category",
  "isNewCategory": true/false,
  "confidence": 0.0-1.0
}
`;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 300
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    const aiResult = JSON.parse(data.choices[0].message.content);
    
    return {
      ...aiResult,
      originalText: contentData.selectedText,
      sourceUrl: contentData.sourceUrl,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error processing content:', error);
    throw error;
  }
}

// Save to Notion
async function saveToNotion(summaryData) {
  try {
    const { notionApiKey, notionDatabaseId } = await chrome.storage.sync.get(['notionApiKey', 'notionDatabaseId']);
    
    if (!notionApiKey || !notionDatabaseId) {
      throw new Error('Notion API credentials not configured');
    }
    
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: notionDatabaseId },
        properties: {
          'Title': {
            title: [{
              text: {
                content: `${summaryData.category} - ${new Date().toLocaleDateString()}`
              }
            }]
          },
          'Category': {
            select: {
              name: summaryData.category
            }
          },
          'Summary': {
            rich_text: [{
              text: {
                content: summaryData.summary
              }
            }]
          },
          'Source URL': {
            url: summaryData.sourceUrl
          },
          'Date Added': {
            date: {
              start: summaryData.timestamp.split('T')[0]
            }
          }
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error('Error saving to Notion:', error);
    throw error;
  }
}

// Expose saveToNotion for popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveToNotion') {
    saveToNotion(request.data)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});