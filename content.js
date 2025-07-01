// Content script for Newsletter Generator

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureSelection') {
    captureSelectedContent();
    sendResponse({ success: true }); // Acknowledge the message
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
  
  // Check for existing unsaved content
  chrome.storage.local.get(['pendingContent'], (result) => {
    if (result.pendingContent) {
      showUnsavedContentDialog(selectedText);
    } else {
      processNewContent(selectedText);
    }
  });
}

// Show dialog for unsaved content
function showUnsavedContentDialog(newSelectedText) {
  const dialog = document.createElement('div');
  dialog.id = 'newsletter-generator-dialog';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 10001;
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    padding: 24px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #333;
  `;
  
  // Create elements programmatically for better reliability
  const title = document.createElement('h3');
  title.textContent = 'Unsaved Content';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #333;';
  
  const message = document.createElement('p');
  message.textContent = 'You have unsaved content in the extension popup. What would you like to do?';
  message.style.cssText = 'margin: 0 0 20px 0; line-height: 1.5; color: #666;';
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  
  // Create buttons
  const saveBtn = document.createElement('button');
  saveBtn.id = 'ng-save-existing';
  saveBtn.textContent = 'Save Existing';
  saveBtn.style.cssText = 'padding: 10px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit;';
  
  const discardBtn = document.createElement('button');
  discardBtn.id = 'ng-discard-existing';
  discardBtn.textContent = 'Discard & Continue';
  discardBtn.style.cssText = 'padding: 10px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit;';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'ng-cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'padding: 10px 16px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit;';
  
  // Add hover effects
  saveBtn.addEventListener('mouseenter', () => saveBtn.style.backgroundColor = '#f8f9fa');
  saveBtn.addEventListener('mouseleave', () => saveBtn.style.backgroundColor = 'white');
  
  discardBtn.addEventListener('mouseenter', () => discardBtn.style.backgroundColor = '#f8f9fa');
  discardBtn.addEventListener('mouseleave', () => discardBtn.style.backgroundColor = 'white');
  
  cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.backgroundColor = '#0056b3');
  cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.backgroundColor = '#007bff');
  
  // Assemble dialog
  buttonContainer.appendChild(saveBtn);
  buttonContainer.appendChild(discardBtn);
  buttonContainer.appendChild(cancelBtn);
  
  dialog.appendChild(title);
  dialog.appendChild(message);
  dialog.appendChild(buttonContainer);
  
  // Add backdrop
  const backdrop = document.createElement('div');
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
  `;
  
  document.body.appendChild(backdrop);
  document.body.appendChild(dialog);
  
  // Handle button clicks
  saveBtn.addEventListener('click', () => {
    // Open popup to save existing content
    chrome.runtime.sendMessage({ action: 'openPopup' });
    removeDialog();
    showNotification('Please save your existing content first', 'info');
  });
  
  discardBtn.addEventListener('click', () => {
    // Clear existing content and process new
    chrome.storage.local.remove(['pendingContent'], () => {
      removeDialog();
      processNewContent(newSelectedText);
    });
  });
  
  cancelBtn.addEventListener('click', () => {
    removeDialog();
  });
  
  function removeDialog() {
    backdrop.remove();
    dialog.remove();
  }
}

// Process new content (extracted from original function)
function processNewContent(selectedText) {
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
        showNotification('Content processed! Opening review popup...', 'success');
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