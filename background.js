// MinMaxer Background Service Worker

class MinMaxerBackground {
    constructor() {
        this.init();
    }

    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Handle extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Handle tab updates
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Handle messages from content scripts and popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Will respond asynchronously
        });
    }

    async handleInstallation(details) {
        console.log('MinMaxer installed:', details);

        // Set default settings on first install
        if (details.reason === 'install') {
            await this.setDefaultSettings();
            
            // Open welcome page or setup
            chrome.tabs.create({
                url: 'popup.html?welcome=true'
            });
        }
    }

    async setDefaultSettings() {
        const defaultSettings = {
            autoAnalyze: true,
            highlightBis: true,
            showRecommendations: true,
            notificationsEnabled: true
        };

        const defaultBisData = {};

        try {
            await chrome.storage.sync.set({
                settings: defaultSettings,
                bisData: defaultBisData
            });
        } catch (error) {
            console.error('Error setting default settings:', error);
        }
    }

    handleStartup() {
        console.log('MinMaxer started');
    }

    async handleTabUpdate(tabId, changeInfo, tab) {
        // Check if tab has finished loading a softres.it page
        if (changeInfo.status === 'complete' && tab.url && tab.url.includes('softres.it')) {
            try {
                const { settings } = await chrome.storage.sync.get(['settings']);
                
                if (settings?.autoAnalyze) {
                    // Send message to content script to analyze the page
                    setTimeout(() => {
                        chrome.tabs.sendMessage(tabId, { action: 'reanalyze' });
                    }, 1000); // Wait a bit for page to fully load
                }
                
                // Update badge to show extension is active
                chrome.action.setBadgeText({
                    tabId: tabId,
                    text: '⚔️'
                });
                
                chrome.action.setBadgeBackgroundColor({
                    tabId: tabId,
                    color: '#ffcd3c'
                });
            } catch (error) {
                console.error('Error handling tab update:', error);
            }
        } else {
            // Clear badge for non-softres pages
            chrome.action.setBadgeText({
                tabId: tabId,
                text: ''
            });
        }
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'analyzeCurrentTab':
                    const result = await this.analyzeCurrentTab();
                    sendResponse(result);
                    break;

                case 'getBadgeInfo':
                    const badgeInfo = await this.getBadgeInfo(request.tabId);
                    sendResponse(badgeInfo);
                    break;

                case 'sendNotification':
                    await this.sendNotification(request.message, request.type);
                    sendResponse({ success: true });
                    break;

                case 'exportBisData':
                    const exportData = await this.exportBisData();
                    sendResponse(exportData);
                    break;

                case 'importBisData':
                    const importResult = await this.importBisData(request.data);
                    sendResponse(importResult);
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async analyzeCurrentTab() {
        try {
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!activeTab.url.includes('softres.it')) {
                return { error: 'Not a softres.it page' };
            }

            // Send message to content script
            const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'reanalyze' });
            return response;
        } catch (error) {
            return { error: error.message };
        }
    }

    async getBadgeInfo(tabId) {
        try {
            if (!tabId) {
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                tabId = activeTab.id;
            }

            const badgeText = await chrome.action.getBadgeText({ tabId });
            return { badgeText };
        } catch (error) {
            return { error: error.message };
        }
    }

    async sendNotification(message, type = 'info') {
        try {
            // Try to send notification to active tab's content script
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (activeTab.url.includes('softres.it')) {
                await chrome.tabs.sendMessage(activeTab.id, {
                    action: 'showNotification',
                    message: message,
                    type: type
                });
            }
        } catch (error) {
            console.error('Error sending notification:', error);
        }
    }

    async exportBisData() {
        try {
            const data = await chrome.storage.sync.get(['bisData', 'settings']);
            
            const exportData = {
                bisData: data.bisData || {},
                settings: data.settings || {},
                exportDate: new Date().toISOString(),
                version: chrome.runtime.getManifest().version
            };

            return { success: true, data: exportData };
        } catch (error) {
            return { error: error.message };
        }
    }

    async importBisData(importData) {
        try {
            if (!importData.bisData) {
                return { error: 'Invalid import data format' };
            }

            await chrome.storage.sync.set({
                bisData: importData.bisData,
                settings: { ...importData.settings }
            });

            return { success: true };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Utility method to get storage data
    async getStorageData(keys) {
        try {
            return await chrome.storage.sync.get(keys);
        } catch (error) {
            console.error('Error getting storage data:', error);
            return {};
        }
    }

    // Utility method to set storage data
    async setStorageData(data) {
        try {
            await chrome.storage.sync.set(data);
            return { success: true };
        } catch (error) {
            console.error('Error setting storage data:', error);
            return { error: error.message };
        }
    }
}

// Initialize background service
const minMaxerBackground = new MinMaxerBackground(); 