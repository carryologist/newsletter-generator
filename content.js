// Content script for Newsletter Generator

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureSelection') {
    captureSelectedContent();
  }
});

// Capture selected text and process it
function captureSelectedContent() {
  const selectedText = window.getSelection().toString().trim();
  
  if (!selectedText) {
    showNotification('Please select some text first', 'warning');
    return;
  }
  
  if (selectedText.length < 10) {
    showNotification('Please select more substantial content', 'warning');
    return;
  }
  
  // Show loading indicator
  showNotification('Processing content...', 'info');
  
  // Send to background script for AI processing
  chrome.runtime.sendMessage({
    action: 'processContent',
    data: {
      selectedText: selectedText,
      sourceUrl: window.location.href,
      pageTitle: document.title
    }
  }, (response) => {
    if (response.success) {
      // Store the processed data and open popup
      chrome.storage.local.set({ 
        pendingContent: response.data 
      }, () => {
        // Open the extension popup
        chrome.runtime.sendMessage({ action: 'openPopup' });
        showNotification('Content processed! Check the extension popup.', 'success');
      });
    } else {
      showNotification(`Error: ${response.error}`, 'error');
    }
  });
}

// Show notification to user
function showNotification(message, type = 'info') {
  // Remove existing notification if any
  const existing = document.getElementById('newsletter-generator-notification');
  if (existing) {
    existing.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.id = 'newsletter-generator-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 16px;
    border-radius: 6px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
    word-wrap: break-word;
    transition: all 0.3s ease;
  `;
  
  // Set color based on type
  const colors = {
    info: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };
  notification.style.backgroundColor = colors[type] || colors.info;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
}

// Add visual feedback for text selection
let selectionTimeout;
document.addEventListener('mouseup', () => {
  clearTimeout(selectionTimeout);
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 10) {
      showSelectionHint();
    }
  }, 500);
});

function showSelectionHint() {
  // Remove existing hint
  const existing = document.getElementById('newsletter-generator-hint');
  if (existing) {
    existing.remove();
  }
  
  const hint = document.createElement('div');
  hint.id = 'newsletter-generator-hint';
  hint.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  hint.textContent = 'Press Ctrl+Shift+N to capture for newsletter';
  document.body.appendChild(hint);
  
  // Fade in
  setTimeout(() => hint.style.opacity = '1', 100);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 300);
  }, 3000);
}

// Clear hint when selection is cleared
document.addEventListener('mousedown', () => {
  const hint = document.getElementById('newsletter-generator-hint');
  if (hint) {
    hint.remove();
  }
});