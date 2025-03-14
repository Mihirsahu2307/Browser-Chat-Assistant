document.addEventListener('DOMContentLoaded', function () {
    // Get DOM elements
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const saveSettingsBtn = document.getElementById('save-settings');
    const openSidebarBtn = document.getElementById('open-sidebar');
    const statusDiv = document.getElementById('status');

    // Focus the openSidebarBtn when popup is loaded
    openSidebarBtn.focus();

    // Load saved API key and model preference
    chrome.storage.local.get(['openaiApiKey', 'openaiModel'], function (result) {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }

        if (result.openaiModel) {
            modelSelect.value = result.openaiModel;
        }
    });

    // Save API key and model preference
    saveSettingsBtn.addEventListener('click', function () {
        const apiKey = apiKeyInput.value.trim();
        const selectedModel = modelSelect.value;

        if (!apiKey) {
            showStatus('Please enter your OpenAI API key', 'error');
            return;
        }

        chrome.storage.local.set({
            openaiApiKey: apiKey,
            openaiModel: selectedModel
        }, function () {
            showStatus('Settings saved successfully', 'success');
        });
    });

    // Open the sidebar
    openSidebarBtn.addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.sidePanel.open({ tabId: tabs[0].id });
            window.close();
        });
    });

    // Also add a keydown event listener to handle Enter key press
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && document.activeElement === openSidebarBtn) {
            openSidebarBtn.click();
        }
    });

    // Helper function to display status messages
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = 'status ' + type;

        // Clear the status after 3 seconds
        setTimeout(function () {
            statusDiv.textContent = '';
            statusDiv.className = 'status';
        }, 3000);
    }
});