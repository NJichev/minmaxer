// MinMaxer Popup JavaScript
class MinMaxerPopup {
    constructor() {
        this.currentRaid = null;
        this.bisData = {};
        this.softresData = {};
        this.availableItems = [];
        this.settings = {
            autoAnalyze: true,
            highlightBis: true,
            showRecommendations: true,
            characterName: ''
        };
        
        this.init();
    }

    async init() {
        console.log('MinMaxer: Popup init() starting...');
        await this.loadStoredData();
        console.log('MinMaxer: Stored data loaded');
        this.setupEventListeners();
        this.setupTabs();
        console.log('MinMaxer: Event listeners and tabs setup');
        await this.updateCurrentRaidInfo();
        console.log('MinMaxer: Current raid info updated');
        this.updateUI();
        console.log('MinMaxer: UI updated, init() complete');
    }

    async loadStoredData() {
        try {
            const result = await chrome.storage.sync.get(['bisData', 'settings']);
            this.bisData = result.bisData || {};
            this.settings = { ...this.settings, ...result.settings };
            
            // Load settings into UI
            document.getElementById('auto-analyze').checked = this.settings.autoAnalyze;
            document.getElementById('highlight-bis').checked = this.settings.highlightBis;
            document.getElementById('show-recommendations').checked = this.settings.showRecommendations;
            document.getElementById('character-name').value = this.settings.characterName;
        this.toggleRecommendations(this.settings.showRecommendations);
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    async saveData() {
        try {
            await chrome.storage.sync.set({
                bisData: this.bisData,
                settings: this.settings
            });
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Raid selection
        document.getElementById('raid-select').addEventListener('change', (e) => {
            this.selectRaid(e.target.value);
        });

        // Add BiS item
        document.getElementById('add-item-btn').addEventListener('click', () => {
            this.addBisItem();
        });

        document.getElementById('item-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addBisItem();
            }
        });

        // Settings
        document.getElementById('auto-analyze').addEventListener('change', (e) => {
            this.settings.autoAnalyze = e.target.checked;
            this.saveData();
        });

        document.getElementById('highlight-bis').addEventListener('change', (e) => {
            this.settings.highlightBis = e.target.checked;
            this.saveData();
        });

        document.getElementById('show-recommendations').addEventListener('change', (e) => {
            this.settings.showRecommendations = e.target.checked;
            this.toggleRecommendations(e.target.checked);
            this.saveData();
        });

        document.getElementById('character-name').addEventListener('input', (e) => {
            this.settings.characterName = e.target.value.trim();
            this.saveData();
        });

        // Data management
        document.getElementById('export-data').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data').addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('reset-data').addEventListener('click', () => {
            this.resetData();
        });

        // Add clear defaults button if needed
        this.addClearDefaultsButton();
    }

    setupTabs() {
        // Default to dashboard tab
        this.switchTab('dashboard');
    }

    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab content
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    async updateCurrentRaidInfo() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (tab.url && tab.url.includes('softres.it')) {
                // Send message to content script to get raid info
                let response = await chrome.tabs.sendMessage(tab.id, { action: 'getRaidInfo' });
                
                // If no raid data yet, trigger reanalysis and try again
                if (!response || !response.raidName) {
                    console.log('MinMaxer: No raid data, triggering reanalysis...');
                    await chrome.tabs.sendMessage(tab.id, { action: 'reanalyze' });
                    response = await chrome.tabs.sendMessage(tab.id, { action: 'getRaidInfo' });
                }
                
                console.log('MinMaxer: Raid info response:', response);
                
                if (response && response.raidName) {
                    console.log('MinMaxer: Setting currentRaid to:', response);
                    this.currentRaid = response;
                    document.getElementById('current-raid').textContent = response.raidName;
                    document.getElementById('raid-status').textContent = `${response.totalPlayers || 'Unknown'} players registered`;
                    
                    // Also get soft reserve data
                    const softresResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getSoftresData' });
                    console.log('MinMaxer: Softres response received:', !!softresResponse, 'keys:', softresResponse ? Object.keys(softresResponse) : 'null');
                    if (softresResponse) {
                        console.log('MinMaxer: itemReserveMap in response:', !!softresResponse.itemReserveMap, 'type:', typeof softresResponse.itemReserveMap);
                        this.softresData = softresResponse;
                        this.availableItems = softresResponse.availableItems || [];
                        this.setupAutoComplete();
                    }
                    
                    // Update BiS competition display after setting currentRaid
                    console.log('MinMaxer: About to call updateBisCompetitionDisplay()');
                    this.updateBisCompetitionDisplay();
                } else {
                    this.currentRaid = null;
                    document.getElementById('current-raid').textContent = 'No raid detected';
                    document.getElementById('raid-status').textContent = 'Visit a softres.it raid page to get started';
                }
            } else {
                this.currentRaid = null;
                document.getElementById('current-raid').textContent = 'No raid detected';
                document.getElementById('raid-status').textContent = 'Visit a softres.it raid page to get started';
            }
        } catch (error) {
            console.error('Error getting raid info:', error);
            this.currentRaid = null;
        }
    }

    selectRaid(raidType) {
        if (!raidType) return;
        
        document.getElementById('selected-raid-name').textContent = 
            document.querySelector(`option[value="${raidType}"]`).textContent;
        
        this.updateBisItemsList(raidType);
    }

    addBisItem() {
        const input = document.getElementById('item-input');
        const itemName = input.value.trim();
        const selectedRaid = document.getElementById('raid-select').value;
        
        console.log('MinMaxer: Adding BiS item:');
        console.log('- Item name:', itemName);
        console.log('- Selected raid key:', selectedRaid);
        console.log('- Selected raid text:', document.querySelector(`option[value="${selectedRaid}"]`)?.textContent);
        
        if (!itemName || !selectedRaid) {
            alert('Please select a raid and enter an item name');
            return;
        }
        
        // Initialize raid data if doesn't exist
        if (!this.bisData[selectedRaid]) {
            this.bisData[selectedRaid] = [];
        }
        
        // Check if item already exists
        if (this.bisData[selectedRaid].some(item => item.name.toLowerCase() === itemName.toLowerCase())) {
            alert('Item already in BiS list for this raid');
            return;
        }
        
        // Add item
        this.bisData[selectedRaid].push({
            name: itemName,
            addedDate: Date.now()
        });
        
        input.value = '';
        this.saveData();
        this.updateBisItemsList(selectedRaid);
        this.updateBisCompetitionDisplay();
    }

    removeBisItem(raidType, itemName) {
        if (this.bisData[raidType]) {
            this.bisData[raidType] = this.bisData[raidType].filter(item => item.name !== itemName);
            this.saveData();
            this.updateBisItemsList(raidType);
            this.updateBisCompetitionDisplay();
        }
    }

    updateBisItemsList(raidType) {
        const container = document.getElementById('bis-items-list');
        const items = this.bisData[raidType] || [];
        
        if (items.length === 0) {
            container.innerHTML = '<p class="empty-state">No BiS items configured. Add items above.</p>';
            return;
        }
        
        container.innerHTML = items.map((item, index) => {
            const details = this.getItemSoftresDetails(item.name);
            const competition = this.getCompetitionLevel(details.competitionCount);
            
            // Build the reserve count display
            let reserveDisplay = '';
            if (details.yourCount > 0) {
                reserveDisplay = `${details.competitionCount} competition`;
                if (details.yourCount > 0) {
                    reserveDisplay += ` <span class="your-reserves">+${details.yourCount} yours</span>`;
                }
            } else {
                reserveDisplay = `${details.competitionCount} soft reserves`;
            }
            
            return `
                <div class="bis-item">
                    <div class="bis-item-info">
                        <div class="bis-item-name">${item.name}</div>
                        <div class="bis-item-count">${reserveDisplay}</div>
                    </div>
                    <span class="bis-item-competition competition-${competition.level}">${competition.text}</span>
                    <button class="remove-item" data-raid="${raidType}" data-item="${item.name}" data-index="${index}">×</button>
                </div>
            `;
        }).join('');

        // Add event listeners for remove buttons
        container.querySelectorAll('.remove-item').forEach(button => {
            button.addEventListener('click', (e) => {
                const raidType = e.target.dataset.raid;
                const itemName = e.target.dataset.item;
                this.removeBisItem(raidType, itemName);
            });
        });
    }

    updateBisCompetitionDisplay() {
        console.log('MinMaxer: === updateBisCompetitionDisplay() START ===');
        
        const container = document.getElementById('bis-competition-list');
        console.log('MinMaxer: Competition container found:', !!container);
        
        console.log('MinMaxer: currentRaid:', this.currentRaid);
        
        if (!this.currentRaid) {
            container.innerHTML = '<p class="empty-state">No raid detected</p>';
            return;
        }
        
        // Determine current raid type
        const currentRaidType = this.detectRaidType(this.currentRaid.raidName);
        const bisItems = this.bisData[currentRaidType] || [];
        
        console.log(`MinMaxer: Competition - raid: ${this.currentRaid.raidName}, type: ${currentRaidType}, items: ${bisItems.length}`);
        
        if (bisItems.length === 0) {
            container.innerHTML = '<p class="empty-state">No BiS items configured for this raid</p>';
            return;
        }
        
        container.innerHTML = bisItems.map(item => {
            const details = this.getItemSoftresDetails(item.name);
            const competition = this.getCompetitionLevel(details.competitionCount);
            
            // Build the reserve count display
            let reserveDisplay = '';
            if (details.yourCount > 0) {
                reserveDisplay = `${details.competitionCount} competition`;
                if (details.yourCount > 0) {
                    reserveDisplay += ` <span class="your-reserves">+${details.yourCount} yours</span>`;
                }
            } else {
                reserveDisplay = `${details.competitionCount} soft reserves`;
            }
            
            return `
                <div class="bis-item">
                    <div class="bis-item-info">
                        <div class="bis-item-name">${item.name}</div>
                        <div class="bis-item-count">${reserveDisplay}</div>
                    </div>
                    <span class="bis-item-competition competition-${competition.level}">${competition.text}</span>
                </div>
            `;
        }).join('');
        
        this.updateRecommendations(bisItems);
    }

    updateRecommendations(bisItems) {
        if (!this.settings.showRecommendations) return;
        
        const container = document.getElementById('recommendation-list');
        const recommendations = [];
        
        // Analyze BiS items and generate recommendations
        const sortedItems = bisItems.map(item => {
            const details = this.getItemSoftresDetails(item.name);
            return {
                ...item,
                count: details.competitionCount,
                yourCount: details.yourCount,
                competition: this.getCompetitionLevel(details.competitionCount)
            };
        }).sort((a, b) => a.count - b.count);
        
        if (sortedItems.length > 0) {
            // Recommend items with lowest competition
            const lowCompetitionItems = sortedItems.filter(item => item.competition.level === 'low');
            if (lowCompetitionItems.length > 0) {
                recommendations.push(`🎯 High chance items: ${lowCompetitionItems.slice(0, 3).map(item => item.name).join(', ')}`);
            }
            
            // Warn about high competition items
            const highCompetitionItems = sortedItems.filter(item => item.competition.level === 'high');
            if (highCompetitionItems.length > 0) {
                recommendations.push(`⚠️ High competition: ${highCompetitionItems.slice(0, 3).map(item => item.name).join(', ')}`);
            }
            
            // Suggest optimal soft reserve strategy
            if (sortedItems.length >= 2) {
                recommendations.push(`💡 Consider soft reserving: ${sortedItems[0].name} (${sortedItems[0].count} reserves) as your primary choice`);
            }
        }
        
        if (recommendations.length === 0) {
            recommendations.push('Configure your BiS items to see recommendations');
        }
        
        container.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    }

    detectRaidType(raidName) {
        const raidMappings = {
            'Molten Core': 'MC',
            'MC': 'MC',
            'Blackwing Lair': 'BWL',
            'BWL': 'BWL',
            'Zul\'Gurub': 'ZG',
            'ZG': 'ZG',
            'Ruins of Ahn\'Qiraj': 'AQ20',
            'AQ20': 'AQ20',
            'Temple of Ahn\'Qiraj': 'AQ40',
            'Ahn\'Qiraj': 'AQ40',
            'AQ40': 'AQ40',
            'Naxxramas': 'NAXX',
            'NAXX': 'NAXX'
        };
        
        for (const [key, value] of Object.entries(raidMappings)) {
            if (raidName && raidName.includes(key)) {
                return value;
            }
        }
        
        return 'UNKNOWN';
    }

    getItemSoftresDetails(itemName) {
        if (!this.softresData?.itemReserveMap) {
            return { totalCount: 0, competitionCount: 0, yourCount: 0 };
        }
        
        const mapData = this.softresData.itemReserveMap;
        const map = new Map(Object.entries(mapData || {}));
        
        let totalCount = 0;
        let foundItemName = null;
        
        // First try exact match
        if (map.has(itemName)) {
            totalCount = map.get(itemName);
            foundItemName = itemName;
        } else {
            // If no exact match, try case-insensitive exact match
            for (const [name, count] of map.entries()) {
                if (name.toLowerCase() === itemName.toLowerCase()) {
                    totalCount = count;
                    foundItemName = name;
                    break;
                }
            }
            
            // If still no match, try partial match
            if (!foundItemName) {
                for (const [name, count] of map.entries()) {
                    if (name.toLowerCase().includes(itemName.toLowerCase()) || 
                        itemName.toLowerCase().includes(name.toLowerCase())) {
                        totalCount = count;
                        foundItemName = name;
                        break;
                    }
                }
            }
        }
        
        // Count how many times the user has this item reserved
        let yourCount = 0;
        const characterName = this.settings.characterName;
        
        if (characterName && foundItemName && this.softresData?.playerReservesMap) {
            const playerReservesData = this.softresData.playerReservesMap;
            const playerReserves = playerReservesData[characterName] || [];
            
            // Count how many times this item appears in the user's reserves
            yourCount = playerReserves.filter(item => 
                item.toLowerCase() === foundItemName.toLowerCase()
            ).length;
        }
        
        const competitionCount = Math.max(0, totalCount - yourCount);
        
        console.log(`MinMaxer: Item "${itemName}" - Total: ${totalCount}, Your: ${yourCount}, Competition: ${competitionCount}`);
        
        return {
            totalCount: totalCount,
            competitionCount: competitionCount,
            yourCount: yourCount
        };
    }

    getItemSoftresCount(itemName) {
        // For backwards compatibility, return competition count (excluding user's reserves)
        return this.getItemSoftresDetails(itemName).competitionCount;
    }

    getCompetitionLevel(count) {
        if (count <= 2) {
            return { level: 'low', text: 'Low' };
        } else if (count <= 5) {
            return { level: 'medium', text: 'Medium' };
        } else {
            return { level: 'high', text: 'High' };
        }
    }

    exportData() {
        const data = {
            bisData: this.bisData,
            settings: this.settings,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'minmaxer-bis-data.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.bisData) {
                        this.bisData = data.bisData;
                    }
                    if (data.settings) {
                        this.settings = { ...this.settings, ...data.settings };
                    }
                    this.saveData();
                    this.updateUI();
                    alert('Data imported successfully!');
                } catch (error) {
                    alert('Error importing data: Invalid file format');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    addClearDefaultsButton() {
        // Check if there are any default items that shouldn't be there
        const hasDefaults = Object.values(this.bisData).some(items => 
            items.some(item => 
                item.name.includes('Thunderfury') || 
                item.name.includes('Shadow Flame') ||
                item.name.includes('Ashkandi') ||
                item.name.includes('Nelth\'s Tear')
            )
        );

        if (hasDefaults) {
            const actionsDiv = document.querySelector('.actions');
            if (actionsDiv && !document.getElementById('clear-defaults')) {
                const clearButton = document.createElement('button');
                clearButton.id = 'clear-defaults';
                clearButton.className = 'btn-danger';
                clearButton.textContent = 'Clear Default Items';
                clearButton.style.marginBottom = '8px';
                
                clearButton.addEventListener('click', () => {
                    this.clearDefaultItems();
                });
                
                actionsDiv.insertBefore(clearButton, actionsDiv.firstChild);
            }
        }
    }

    clearDefaultItems() {
        const defaultItems = ['Thunderfury', 'Shadow Flame', 'Ashkandi', 'Nelth\'s Tear'];
        let clearedAny = false;

        Object.keys(this.bisData).forEach(raidType => {
            const originalLength = this.bisData[raidType].length;
            this.bisData[raidType] = this.bisData[raidType].filter(item => 
                !defaultItems.some(defaultItem => item.name.includes(defaultItem))
            );
            if (this.bisData[raidType].length < originalLength) {
                clearedAny = true;
            }
        });

        if (clearedAny) {
            this.saveData();
            this.updateUI();
            alert('Default items have been removed');
            
            // Remove the clear defaults button
            const clearButton = document.getElementById('clear-defaults');
            if (clearButton) {
                clearButton.remove();
            }
        }
    }

    resetData() {
        if (confirm('Are you sure you want to reset all BiS data? This cannot be undone.')) {
            this.bisData = {};
            this.saveData();
            this.updateUI();
            alert('All data has been reset');
            
            // Remove clear defaults button if it exists
            const clearButton = document.getElementById('clear-defaults');
            if (clearButton) {
                clearButton.remove();
            }
        }
    }

    setupAutoComplete() {
        const itemInput = document.getElementById('item-input');
        if (!itemInput) return;

        // Create or update datalist for auto-completion
        let datalist = document.getElementById('item-suggestions');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'item-suggestions';
            document.body.appendChild(datalist);
            itemInput.setAttribute('list', 'item-suggestions');
        }

        // Clear existing options
        datalist.innerHTML = '';

        // Add available items as options
        this.availableItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item.name;
            datalist.appendChild(option);
        });

        console.log(`MinMaxer: Added ${this.availableItems.length} items for auto-completion`);
    }

    updateUI() {
        console.log('MinMaxer: updateUI() called');
        
        // Update raid selection if current raid is detected
        if (this.currentRaid) {
            const raidType = this.detectRaidType(this.currentRaid.raidName);
            console.log('MinMaxer: updateUI raid detection:');
            console.log('- Current raid name:', this.currentRaid.raidName);
            console.log('- Detected raid type:', raidType);
            
            if (raidType !== 'UNKNOWN') {
                console.log('- Setting dropdown to:', raidType);
                document.getElementById('raid-select').value = raidType;
                this.selectRaid(raidType);
            }
        } else {
            console.log('MinMaxer: No currentRaid in updateUI()');
        }
        
        this.updateBisCompetitionDisplay();
        this.setupAutoComplete();
        this.addClearDefaultsButton();
    }

    toggleRecommendations(show) {
        const recommendationsSection = document.getElementById('recommendations');
        if (recommendationsSection) {
            recommendationsSection.style.display = show ? 'block' : 'none';
        }
    }
}

// Initialize popup
try {
    console.log('MinMaxer: Creating popup instance...');
    const popup = new MinMaxerPopup();
    window.popup = popup; // Make it globally accessible for onclick handlers
    console.log('MinMaxer: Popup instance created successfully');
} catch (error) {
    console.error('MinMaxer: Error creating popup:', error);
} 