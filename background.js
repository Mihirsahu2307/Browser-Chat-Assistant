// Track which tabs have the panel open
const openPanelTabs = new Set();

// Handle icon click and keyboard shortcut
chrome.action.onClicked.addListener(handleAction);

chrome.commands.onCommand.addListener((command) => {
  if (command === "_execute_action") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) handleAction(tabs[0]);
    });
  }
});

// Handle action (from click or shortcut)
function handleAction(tab) {
  chrome.storage.local.get(['openaiApiKey'], (result) => {
    // If API key exists, toggle sidebar directly
    if (result.openaiApiKey) {
      toggleSidePanel(tab.id);
    } else {
      // Otherwise show popup to set API key
      chrome.action.openPopup();
    }
  });
}

// Function to toggle the side panel
function toggleSidePanel(tabId) {
  if (openPanelTabs.has(tabId)) {
    chrome.sidePanel.close({ tabId });
    openPanelTabs.delete(tabId);
  } else {
    chrome.sidePanel.open({ tabId });
    openPanelTabs.add(tabId);
  }
}

// Track side panel state changes
chrome.sidePanel.onOpened.addListener(({ tabId }) => {
  openPanelTabs.add(tabId);
});

chrome.sidePanel.onClosed.addListener(({ tabId }) => {
  openPanelTabs.delete(tabId);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['openaiApiKey', 'conversations'], (result) => {
    if (!result.openaiApiKey) {
      chrome.storage.local.set({ openaiApiKey: '' });
    }
    if (!result.conversations) {
      chrome.storage.local.set({ conversations: [] });
    }
  });
});