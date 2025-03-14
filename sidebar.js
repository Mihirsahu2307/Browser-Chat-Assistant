document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const modelSelect = document.getElementById('model-select');
  const clearChatButton = document.getElementById('clear-chat');
  const apiStatus = document.getElementById('api-status');
  const { marked } = window;
  
  // Conversation history
  let conversations = [];
  
  // Load saved settings and conversation history
  loadSettings();
  
  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  clearChatButton.addEventListener('click', clearConversation);
  modelSelect.addEventListener('change', function() {
    chrome.storage.local.set({ openaiModel: modelSelect.value });
  });
  
  // Function to load settings
  function loadSettings() {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'conversations'], function(result) {
      if (result.openaiModel) {
        modelSelect.value = result.openaiModel;
      }
      
      if (result.conversations && result.conversations.length > 0) {
        conversations = result.conversations;
        displayConversation();
      }
    });
  }
  
  // Function to send a message
  function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;
    
    // Add user message to conversation
    conversations.push({ role: 'user', content: message });
    displayMessage(message, 'user');
    userInput.value = '';
    
    // Save the updated conversation
    saveConversation();
    
    // Show typing indicator
    showTypingIndicator();
    
    // Send to OpenAI API
    sendToOpenAI(conversations);
  }
  
  // Function to send to OpenAI API
  function sendToOpenAI(messages) {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel'], function(result) {
      if (!result.openaiApiKey) {
        apiStatus.textContent = 'API key not set. Please set your OpenAI API key in the popup.';
        apiStatus.className = 'api-status error';
        removeTypingIndicator();
        return;
      }
      
      const model = result.openaiModel || 'gpt-4o';
      
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openaiApiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          max_tokens: 2000
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Remove typing indicator
        removeTypingIndicator();
        
        // Get the assistant's response
        const assistantResponse = data.choices[0].message.content;
        
        // Add assistant response to conversation
        conversations.push({ role: 'assistant', content: assistantResponse });
        
        // Display the message with formatted code blocks
        displayMessage(assistantResponse, 'assistant');
        
        // Save the updated conversation
        saveConversation();
      })
      .catch(error => {
        console.error('Error:', error);
        removeTypingIndicator();
        apiStatus.textContent = `Error: ${error.message}`;
        apiStatus.className = 'api-status error';
      });
    });
  }

  // Add to sidebar.js
  function simpleMarkdownToHtml(markdown) {
    // Convert code blocks
    let html = markdown.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
      return `<pre><code class="language-${language}">${code.trim()}</code></pre>`;
    });
    
    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert paragraphs
    html = html.split('\n\n').map(p => `<p>${p}</p>`).join('');
    
    // Convert line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
  }
  
  // Function to display a message
  function displayMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    // First, preprocess code blocks to preserve line breaks
    const processedMessage = message.replace(/```(\w*)([\s\S]*?)```/g, function(match, language, code) {
      // Properly preserve indentation and line breaks
      const formattedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code class="language-${language || 'plaintext'}">${formattedCode}</code></pre>`;
    });
    
    try {
      if (typeof marked.parse === 'function') {
        messageElement.innerHTML = marked.parse(processedMessage);
      } else if (typeof marked === 'function') {
        messageElement.innerHTML = marked(processedMessage);
      } else {
        messageElement.innerHTML = processedMessage;
      }
    } catch (error) {
      console.error('Markdown parsing error:', error);
      messageElement.innerHTML = processedMessage;
    }
    
    // Process code blocks
    const codeBlocks = messageElement.querySelectorAll('pre code');
    codeBlocks.forEach(codeBlock => {
      if (window.hljs) {
        try {
          hljs.highlightElement(codeBlock);
        } catch (error) {
          console.error('Highlighting error:', error);
        }
      }
      
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.textContent = 'Copy';
      copyButton.addEventListener('click', function() {
        copyToClipboard(codeBlock.textContent);
        copyButton.textContent = 'Copied!';
        setTimeout(() => copyButton.textContent = 'Copy', 2000);
      });
      
      codeBlock.parentElement.appendChild(copyButton);
    });
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  // Function to display the entire conversation
  function displayConversation() {
    chatContainer.innerHTML = '';
    conversations.forEach(msg => {
      displayMessage(msg.content, msg.role);
    });
  }
  
  // Function to clear the conversation
  function clearConversation() {
    conversations = [];
    chatContainer.innerHTML = '';
    saveConversation();
  }
  
  // Function to save the conversation
  function saveConversation() {
    chrome.storage.local.set({ conversations: conversations });
  }
  
  // Show typing indicator
  function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'message assistant-message typing-indicator';
    typingIndicator.id = 'typing-indicator';
    typingIndicator.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
    `;
    chatContainer.appendChild(typingIndicator);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  
  // Remove typing indicator
  function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }
  
  // Helper function to copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }
});