document.addEventListener('DOMContentLoaded', function () {
  // DOM elements
  const chatContainer = document.getElementById('chat-container');
  const userInput = document.getElementById('user-input');
  const sendButton = document.getElementById('send-button');
  const modelSelect = document.getElementById('model-select');
  const clearChatButton = document.getElementById('clear-chat');
  const apiStatus = document.getElementById('api-status');

  // Initialization and check for libraries
  let markedLib = null;
  let highlightJsLib = null;

  // Initialize marked library
  function initializeMarked() {
    console.log("Initializing marked library...");

    // Check if marked is already available in window
    if (window.marked) {
      console.log("Found marked in window object");
      markedLib = window.marked;

      // Configure if the API allows it
      if (typeof markedLib.setOptions === 'function') {
        markedLib.setOptions({
          breaks: true,  // Enable line breaks
          gfm: true,     // Enable GitHub Flavored Markdown
          highlight: function (code, lang) {
            // Use highlight.js for syntax highlighting if available
            if (highlightJsLib && lang) {
              try {
                return highlightJsLib.highlight(code, { language: lang }).value;
              } catch (e) {
                console.warn("Failed to highlight code block:", e);
                return code;
              }
            }
            return code;
          }
        });
        console.log("Marked configured successfully");
      } else {
        console.log("Marked found but doesn't have setOptions method");
      }
      return true;
    } else {
      console.warn("Marked not found in window object. Trying alternative approach...");

      // As a fallback, try to load it manually if it wasn't loaded properly
      try {
        const script = document.createElement('script');
        script.src = 'libs/marked.min.js';
        script.onload = function () {
          console.log("Marked script loaded successfully");
          if (window.marked) {
            markedLib = window.marked;
            if (typeof markedLib.setOptions === 'function') {
              markedLib.setOptions({
                breaks: true,
                gfm: true,
                highlight: function (code, lang) {
                  if (highlightJsLib && lang) {
                    try {
                      return highlightJsLib.highlight(code, { language: lang }).value;
                    } catch (e) {
                      console.warn("Failed to highlight code block:", e);
                      return code;
                    }
                  }
                  return code;
                }
              });
            }
            console.log("Marked initialized after manual loading");
          } else {
            console.error("Marked still not available after loading");
          }
        };
        script.onerror = function () {
          console.error("Failed to load marked.min.js from libs folder");
        };
        document.head.appendChild(script);
        return false;
      } catch (e) {
        console.error("Error while attempting to load marked:", e);
        return false;
      }
    }
  }

  // Initialize highlight.js library
  function initializeHighlightJs() {
    console.log("Initializing highlight.js library...");

    // Check if highlight.js is already available
    if (window.hljs) {
      console.log("Found highlight.js in window object");
      highlightJsLib = window.hljs;
      return true;
    } else {
      console.warn("highlight.js not found in window object. Trying to load it...");

      try {
        // Load highlight.js script
        const script = document.createElement('script');
        script.src = 'libs/highlight.min.js';
        script.onload = function () {
          console.log("highlight.js script loaded successfully");
          if (window.hljs) {
            highlightJsLib = window.hljs;
            // Reload marked to use the newly loaded highlight.js
            if (markedLib && typeof markedLib.setOptions === 'function') {
              configureMarkedWithHighlighting();
            }
            console.log("highlight.js initialized after manual loading");
          } else {
            console.error("highlight.js still not available after loading");
          }
        };
        script.onerror = function () {
          console.error("Failed to load highlight.min.js from libs folder");
        };
        document.head.appendChild(script);
        return false;
      } catch (e) {
        console.error("Error while attempting to load highlight.js:", e);
        return false;
      }
    }
  }

  // Configure marked with highlighting if both libraries are loaded
  function configureMarkedWithHighlighting() {
    if (markedLib && highlightJsLib && typeof markedLib.setOptions === 'function') {
      markedLib.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
          if (lang) {
            try {
              return highlightJsLib.highlight(code, { language: lang }).value;
            } catch (e) {
              console.warn("Failed to highlight code block:", e);
              return code;
            }
          }
          return code;
        }
      });
      console.log("Marked configured with highlight.js integration");
    }
  }

  // Initialize libraries
  const markedInitialized = initializeMarked();
  const highlightJsInitialized = initializeHighlightJs();

  // If both libraries are initialized, configure them to work together
  if (markedInitialized && highlightJsInitialized) {
    configureMarkedWithHighlighting();
  }

  // Conversation history
  let conversations = [];

  // Load saved settings and conversation history
  loadSettings();

  // Event listeners
  sendButton.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  clearChatButton.addEventListener('click', clearConversation);
  modelSelect.addEventListener('change', function () {
    chrome.storage.local.set({ openaiModel: modelSelect.value });
  });

  // Function to focus the user input field
  function focusUserInput() {
    if (userInput) {
      userInput.focus();
    }
  }

  // Function to load settings
  function loadSettings() {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel', 'conversations'], function (result) {
      if (result.openaiModel) {
        modelSelect.value = result.openaiModel;
      }

      if (result.conversations && result.conversations.length > 0) {
        conversations = result.conversations;
        displayConversation();
      }

      // Focus again after loading is complete
      focusUserInput();
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
  // Function to send to OpenAI API with streaming (SSE) and conditional auto-scroll
  function sendToOpenAI(messages) {
    chrome.storage.local.get(['openaiApiKey', 'openaiModel'], function (result) {
      if (!result.openaiApiKey) {
        apiStatus.textContent =
          'API key not set. Please set your OpenAI API key in the popup.';
        apiStatus.className = 'api-status error';
        removeTypingIndicator();
        return;
      }

      const model = result.openaiModel || 'gpt-4o';

      // Prepare request body with streaming enabled
      const requestBody = {
        model: model,
        messages: messages,
        max_tokens: 4000,
        stream: true // Enable streaming responses
      };

      // For reasoning models, adjust the request accordingly
      if (/^(o1|o1-mini|o3|o3-mini)$/.test(model)) {
        requestBody.reasoning_effort = 'medium';
        if (requestBody.hasOwnProperty('max_tokens')) {
          delete requestBody['max_tokens'];
        }
      }

      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.openaiApiKey}`
        },
        body: JSON.stringify(requestBody)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let assistantResponse = '';

          // Create a temporary element for the streaming assistant message
          const tempMessageElement = document.createElement('div');
          tempMessageElement.className = 'message assistant-message';
          chatContainer.appendChild(tempMessageElement);

          // Helper: only auto-scroll if user is near the bottom
          function autoScroll() {
            const threshold = 50; // pixels from the bottom to consider "near"
            if (chatContainer.scrollHeight - chatContainer.clientHeight - chatContainer.scrollTop < threshold) {
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          }

          // Recursive function to process the stream chunks
          function readStream() {
            return reader.read().then(({ done, value }) => {
              if (done) {
                removeTypingIndicator();
                conversations.push({ role: 'assistant', content: assistantResponse });
                saveConversation();
                return;
              }
              // Decode the chunk and split into lines
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n").filter(line => line.trim() !== "");
              for (let line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    removeTypingIndicator();
                    conversations.push({ role: 'assistant', content: assistantResponse });
                    saveConversation();
                    return;
                  }
                  try {
                    // Parse the streamed JSON chunk
                    const parsed = JSON.parse(data);
                    const content = parsed.choices[0].delta.content;
                    if (content) {
                      assistantResponse += content;
                      // Render the current assistant response using marked if available,
                      // otherwise fall back to the custom formatter.
                      if (markedLib && (typeof markedLib.parse === 'function' || typeof markedLib === 'function')) {
                        if (typeof markedLib.parse === 'function') {
                          tempMessageElement.innerHTML = markedLib.parse(assistantResponse);
                        } else {
                          tempMessageElement.innerHTML = markedLib(assistantResponse);
                        }
                      } else {
                        tempMessageElement.innerHTML = formatCodeWithHighlighting(assistantResponse);
                      }
                      // Only auto-scroll if the user is near the bottom
                      autoScroll();
                    }
                  } catch (e) {
                    console.error("Error parsing stream data", e);
                  }
                }
              }
              return readStream();
            });
          }
          return readStream();
        })
        .catch(error => {
          console.error('Error:', error);
          removeTypingIndicator();
          apiStatus.textContent = `Error: ${error.message}`;
          apiStatus.className = 'api-status error';
        });
    });
  }


  // Enhanced formatter for code blocks with syntax highlighting
  function formatCodeWithHighlighting(text) {
    // Escape HTML first
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    // Convert code blocks with language detection
    html = html.replace(/```(\w*)([\s\S]*?)```/g, function (match, language, code) {
      // Apply syntax highlighting if highlight.js is available
      if (highlightJsLib && language) {
        try {
          const highlighted = highlightJsLib.highlight(code.trim(), { language: language }).value;
          return `<pre><code class="language-${language}">${highlighted}</code></pre>`;
        } catch (e) {
          console.warn("Failed to highlight code block:", e);
          return `<pre><code class="language-${language || 'plaintext'}">${code}</code></pre>`;
        }
      }
      return `<pre><code class="language-${language || 'plaintext'}">${code}</code></pre>`;
    });

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert paragraphs (double line breaks)
    const paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    return html;
  }

  // Function to display a message with proper formatting
  function displayMessage(message, sender) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;

    try {
      // First, try to use the marked library if it's available
      if (markedLib && (typeof markedLib.parse === 'function' || typeof markedLib === 'function')) {
        console.log("Using marked library for rendering");

        // Pre-process code blocks to preserve formatting
        let processedMessage = message;

        if (typeof markedLib.parse === 'function') {
          messageElement.innerHTML = markedLib.parse(processedMessage);
        } else if (typeof markedLib === 'function') {
          messageElement.innerHTML = markedLib(processedMessage);
        } else {
          // Fallback to our enhanced custom formatter
          console.log("Marked API not as expected, using custom formatter");
          messageElement.innerHTML = formatCodeWithHighlighting(processedMessage);
        }
      } else {
        // If marked isn't available or initialized yet, use our enhanced custom formatter
        console.log("Marked not available, using custom formatter");
        messageElement.innerHTML = formatCodeWithHighlighting(message);
      }
    } catch (error) {
      console.error('Parsing error:', error);
      // Very basic fallback if everything else fails
      messageElement.innerHTML = message
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, '<br>');
    }

    // Process code blocks for syntax highlighting and add copy buttons
    const codeBlocks = messageElement.querySelectorAll('pre code');
    codeBlocks.forEach(codeBlock => {
      // Apply syntax highlighting if hljs is available and wasn't already applied through marked
      if (highlightJsLib && !codeBlock.classList.contains('hljs')) {
        try {
          highlightJsLib.highlightElement(codeBlock);
        } catch (error) {
          console.error('Highlighting error:', error);
        }
      }

      // Enhance code block appearance
      const preElement = codeBlock.parentElement;
      if (preElement && preElement.tagName === 'PRE') {
        // Make sure the pre element has proper styling
        preElement.style.position = 'relative';
        preElement.style.margin = '16px 0';
        preElement.classList.add('code-block');

        // Add language label to code block if available
        const languageClass = Array.from(codeBlock.classList)
          .find(cls => cls.startsWith('language-'));

        if (languageClass) {
          const language = languageClass.replace('language-', '');
          if (language && language !== 'plaintext') {
            const languageLabel = document.createElement('div');
            languageLabel.className = 'language-label';
            languageLabel.textContent = language;
            languageLabel.style.position = 'absolute';
            languageLabel.style.top = '0';
            languageLabel.style.left = '0';
            languageLabel.style.padding = '2px 6px';
            languageLabel.style.fontSize = '10px';
            languageLabel.style.background = '#e1e1e1';
            languageLabel.style.borderRadius = '0 0 4px 0';
            languageLabel.style.color = '#666';
            preElement.appendChild(languageLabel);
          }
        }

        // Add copy button to code block
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.addEventListener('click', function () {
          copyToClipboard(codeBlock.textContent);
          copyButton.textContent = 'Copied!';
          setTimeout(() => copyButton.textContent = 'Copy', 2000);
        });

        preElement.appendChild(copyButton);
      }
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

  // Initial focus
  focusUserInput();
});