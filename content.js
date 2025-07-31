// MinMaxer Content Script for softres.it
class SoftresAnalyzer {
    constructor() {
        this.raidData = null;
        this.softresData = null;
        this.bisHighlights = [];
        
        // Debug flag - set to true to enable debug logging
        this.DEBUG = false;
        
        this.init();
    }
    
    log(...args) {
        if (this.DEBUG) {
            console.log(...args);
        }
    }

    init() {
        // Wait for page to load completely
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.analyzePage());
        } else {
            this.analyzePage();
        }

        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sendResponse);
            return true; // Will respond asynchronously
        });

        // Set up observer for dynamic content changes
        this.setupPageObserver();
    }

    setupPageObserver() {
        const observer = new MutationObserver(() => {
            // Re-analyze when page content changes
            setTimeout(() => this.analyzePage(), 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    analyzePage() {
        try {
            this.extractRaidInfo();
            this.extractSoftresData();
            this.highlightBisItems();
            
            console.log('MinMaxer: Page analyzed', {
                raid: this.raidData,
                softres: this.softresData
            });
        } catch (error) {
            console.error('MinMaxer: Error analyzing page:', error);
        }
    }

    extractRaidInfo() {
        // Try different selectors for raid name
        const raidSelectors = [
            'h1', 
            '.raid-title',
            '.page-title',
            '[class*="title"]',
            '[class*="raid"]'
        ];

        let raidName = null;
        
        for (const selector of raidSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const text = element.textContent.trim();
                // Check if it looks like a raid name
                if (this.isRaidName(text)) {
                    raidName = text;
                    break;
                }
            }
        }

        // Fallback: look for common raid names in page content
        if (!raidName) {
            const bodyText = document.body.textContent;
            const raidNames = [
                'Molten Core', 'MC',
                'Blackwing Lair', 'BWL', 
                'Ruins of Ahn\'Qiraj', 'AQ20',
                'Temple of Ahn\'Qiraj', 'Ahn\'Qiraj', 'AQ40',
                'Naxxramas', 'NAXX'
            ];
            
            for (const name of raidNames) {
                if (bodyText.includes(name)) {
                    raidName = name;
                    break;
                }
            }
        }

        // Count players
        const playerCount = this.countPlayers();

        this.raidData = {
            raidName: raidName || 'Unknown Raid',
            totalPlayers: playerCount,
            url: window.location.href,
            timestamp: Date.now()
        };
    }

    isRaidName(text) {
        const raidKeywords = [
            'molten', 'core', 'mc',
            'blackwing', 'lair', 'bwl',
            'zul\'gurub', 'zulgarub', 'zg',
            'ahn\'qiraj', 'aq20', 'aq40', 'ruins', 'temple',
            'naxxramas', 'naxx'
        ];
        
        const lowerText = text.toLowerCase();
        return raidKeywords.some(keyword => lowerText.includes(keyword));
    }

    countPlayers() {
        // Count rows in the reserved table (each row = one player with reserves)
        const reservedTable = document.querySelector('#table-reserved');
        
        if (reservedTable) {
            const rows = reservedTable.querySelectorAll('tr');
            // Subtract 1 for header row
            const playerCount = Math.max(0, rows.length - 1);
            this.log(`MinMaxer: Counted ${playerCount} players from #table-reserved (${rows.length} total rows)`);
            return playerCount;
        }
        
        // Fallback: try generic table counting
        const tableRows = document.querySelectorAll('table tbody tr');
        if (tableRows.length > 1) {
            return tableRows.length - 1;
        }
        
        this.log('MinMaxer: No reserved table found, returning 0 players');
        return 0;
    }

    extractSoftresData() {
        // Build a simple item name => soft reserve count map from the items table
        const itemReserveMap = this.buildItemReserveMap();
        
        // Build player reserves map from the reserved table
        const playerReservesMap = this.buildPlayerReservesMap();
        
        // Convert map to array format for compatibility
        const itemsArray = Array.from(itemReserveMap.entries()).map(([name, count]) => ({
            name: name,
            count: count
        }));
        
        // Convert Map to plain object for Chrome messaging compatibility
        const itemReserveObject = Object.fromEntries(itemReserveMap);
        const playerReservesObject = Object.fromEntries(playerReservesMap);
        this.log(`MinMaxer: Converted Map (${itemReserveMap.size} items) to Object (${Object.keys(itemReserveObject).length} keys)`);
        this.log(`MinMaxer: Built player reserves map with ${playerReservesMap.size} players`);
        
        this.softresData = {
            itemReserveMap: itemReserveObject, // Convert Map to Object for messaging
            playerReservesMap: playerReservesObject, // Player => [items] mapping
            items: itemsArray, // For compatibility
            availableItems: itemsArray, // For auto-completion
            totalItems: itemsArray.length,
            timestamp: Date.now()
        };

        console.log('MinMaxer: Built item reserve map:', {
            totalItems: itemReserveMap.size,
            itemsWithReserves: Array.from(itemReserveMap.values()).filter(count => count > 0).length
        });

        // Log items with reserves for easy debugging
        const reservedItems = Array.from(itemReserveMap.entries()).filter(([name, count]) => count > 0);
        if (reservedItems.length > 0) {
            console.log('MinMaxer: Items with soft reserves:', 
                reservedItems.map(([name, count]) => `"${name}": ${count}`).join(', ')
            );
        }
    }

    buildItemReserveMap() {
        const itemMap = new Map();
        
        // Target the specific items table by ID
        const itemsTable = document.querySelector('#table-items');
        
        if (!itemsTable) {
            this.log('MinMaxer: Items table (#table-items) not found');
            return itemMap;
        }
        
        const rows = itemsTable.querySelectorAll('tr');
        this.log(`MinMaxer: Found items table with ${rows.length} rows`);
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 5) continue; // Need at least 5 columns: Name, Slot, ilvl, From, Soft-reservers
            
            let itemName = null;
            let reserveCount = 0;
            
            // Column 1: Item name (index 0)
            const nameCell = cells[0];
            if (nameCell) {
                // Check for item links first (wowhead, classicdb, wowdb)
                const itemLink = nameCell.querySelector('a[href*="wowhead"], a[href*="classicdb"], a[href*="wowdb"]');
                if (itemLink) {
                    itemName = itemLink.textContent.trim();
                } else {
                    // Otherwise use the cell text directly
                    const text = nameCell.textContent.trim();
                    if (text && text.length > 2 && !text.match(/^(name|item)$/i)) {
                        itemName = text;
                    }
                }
            }
            
            // Column 5: Soft-reservers count (index 4)
            const reserveCell = cells[4];
            if (itemName && reserveCell) {
                // Count the number of .item-row divs (each represents one soft reserver)
                const playerDivs = reserveCell.querySelectorAll('.item-row');
                reserveCount = playerDivs.length;
                
                // Debug logging for Eye of C'thun specifically
                if (itemName.includes("Eye of C'Thun") || itemName.includes("Eye of C'thun")) {
                    this.log('MinMaxer DEBUG: Eye of C\'thun found!');
                    this.log('- Item name:', itemName);
                    this.log('- Reserve cell HTML:', reserveCell.innerHTML);
                    this.log('- Player divs found:', playerDivs.length);
                    this.log('- Player divs:', playerDivs);
                }
                
                // Add to map
                itemMap.set(itemName, reserveCount);
            }
        }
        
        this.log(`MinMaxer: Built item reserve map with ${itemMap.size} items from #table-items`);
        
        // Debug: Show some items in the map, especially Eye of C'thun
        const eyeOfCthun = itemMap.get("Eye of C'Thun");
        if (eyeOfCthun !== undefined) {
            this.log(`MinMaxer DEBUG: "Eye of C'Thun" in map with count: ${eyeOfCthun}`);
        }
        
        // Show a few items from the map for debugging
        let debugCount = 0;
        for (const [name, count] of itemMap.entries()) {
            if (count > 0 && debugCount < 5) {
                this.log(`MinMaxer DEBUG: "${name}" => ${count} reserves`);
                debugCount++;
            }
        }
        
        return itemMap;
    }

    buildPlayerReservesMap() {
        const playerMap = new Map();
        
        // Target the reserved table by ID
        const reservedTable = document.querySelector('#table-reserved');
        
        if (!reservedTable) {
            this.log('MinMaxer: Reserved table (#table-reserved) not found');
            return playerMap;
        }
        
        const rows = reservedTable.querySelectorAll('tr');
        this.log(`MinMaxer: Found reserved table with ${rows.length} rows`);
        
        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');
            if (cells.length < 3) continue; // Need at least 3 columns: Name, Class, Items
            
            // Column 1: Player name (index 0)
            const nameCell = cells[0];
            let playerName = null;
            if (nameCell) {
                // Look for player name in the span or use cell text directly
                const nameSpan = nameCell.querySelector('span[title]');
                if (nameSpan) {
                    playerName = nameSpan.textContent.trim();
                } else {
                    const text = nameCell.textContent.trim();
                    if (text && text.length > 1 && !text.match(/^(name|player)$/i)) {
                        playerName = text;
                    }
                }
            }
            
            // Column 3: Items (index 2)
            const itemsCell = cells[2];
            if (playerName && itemsCell) {
                const itemLinks = itemsCell.querySelectorAll('a[href*="wowhead"], a[href*="classicdb"], a[href*="wowdb"]');
                const items = [];
                
                itemLinks.forEach(link => {
                    const itemText = link.querySelector('.itemlink-text');
                    if (itemText) {
                        let itemName = itemText.textContent.trim();
                        // Remove any "(2x)" or similar suffixes
                        itemName = itemName.replace(/\s*\(\d+x\)\s*$/, '');
                        if (itemName) {
                            items.push(itemName);
                        }
                    }
                });
                
                if (items.length > 0) {
                    playerMap.set(playerName, items);
                    this.log(`MinMaxer: Player "${playerName}" has ${items.length} reserves:`, items.join(', '));
                } else {
                    this.log(`MinMaxer: Player "${playerName}" found but no valid items parsed`);
                }
            }
        }
        
        this.log(`MinMaxer: Built player reserves map with ${playerMap.size} players`);
        
        // Debug: Show all players found
        for (const [player, items] of playerMap.entries()) {
            this.log(`MinMaxer: "${player}" => [${items.join(', ')}]`);
        }
        
        return playerMap;
    }





    extractItemName(element) {
        if (!element) return null;

        // Method 1: Check href for item ID and use title/text
        const href = element.href;
        if (href && (href.includes('wowhead') || href.includes('classicdb') || href.includes('wowdb'))) {
            const title = element.title || element.textContent.trim();
            if (title && title.length > 3) return title;
        }

        // Method 2: Check data attributes first
        const itemName = element.dataset.item || element.dataset.itemName || element.dataset.name;
        if (itemName && itemName.length > 3) return itemName;

        // Method 3: Use element text content
        const text = element.textContent.trim();
        if (text && text.length > 3 && text.length < 100) {
            // Filter out common non-item text
            const nonItemKeywords = ['player', 'user', 'class', 'role', 'status', 'reserve', 'softres', 'edit', 'delete', 'save', 'cancel', 'submit'];
            const lowerText = text.toLowerCase();
            
            if (!nonItemKeywords.some(keyword => lowerText.includes(keyword))) {
                return text;
            }
        }

        return null;
    }

    extractItemId(element) {
        if (!element) return null;

        // Check href for item ID
        const href = element.href;
        if (href) {
            const wowheadMatch = href.match(/item[=/](\d+)/);
            const classicdbMatch = href.match(/item[=/](\d+)/);
            const wowdbMatch = href.match(/item[=/](\d+)/);
            
            if (wowheadMatch) return wowheadMatch[1];
            if (classicdbMatch) return classicdbMatch[1];
            if (wowdbMatch) return wowdbMatch[1];
        }

        // Check data attributes
        return element.dataset.itemId || element.dataset.id || element.id || null;
    }



    async highlightBisItems() {
        try {
            // Get BiS items from storage
            const { bisData, settings } = await chrome.storage.sync.get(['bisData', 'settings']);
            
            if (!settings?.highlightBis || !bisData) return;

            // Clear existing highlights
            this.clearHighlights();

            // Detect current raid type
            const raidType = this.detectRaidType();
            const bisItems = bisData[raidType] || [];

            if (bisItems.length === 0) return;

            // Find and highlight BiS items on the page
            bisItems.forEach(bisItem => {
                this.highlightItem(bisItem.name);
            });

        } catch (error) {
            console.error('MinMaxer: Error highlighting BiS items:', error);
        }
    }

    detectRaidType() {
        if (!this.raidData) return 'UNKNOWN';

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
            if (this.raidData.raidName.includes(key)) {
                return value;
            }
        }

        return 'UNKNOWN';
    }

    highlightItem(itemName) {
        // Find all elements containing the item name
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(itemName.toLowerCase())) {
                textNodes.push(node);
            }
        }

        textNodes.forEach(textNode => {
            const parent = textNode.parentElement;
            if (parent && !parent.classList.contains('minmaxer-highlight')) {
                parent.classList.add('minmaxer-highlight');
                parent.style.backgroundColor = '#ffcd3c33';
                parent.style.border = '2px solid #ffcd3c';
                parent.style.borderRadius = '4px';
                parent.style.padding = '2px';
                parent.title = `MinMaxer: ${itemName} (BiS Item)`;
                
                this.bisHighlights.push(parent);
            }
        });
    }

    clearHighlights() {
        this.bisHighlights.forEach(element => {
            element.classList.remove('minmaxer-highlight');
            element.style.backgroundColor = '';
            element.style.border = '';
            element.style.borderRadius = '';
            element.style.padding = '';
            element.title = '';
        });
        this.bisHighlights = [];
    }

    handleMessage(request, sendResponse) {
        switch (request.action) {
            case 'getRaidInfo':
                sendResponse(this.raidData);
                break;
                
            case 'getSoftresData':
                this.log('MinMaxer: Sending softresData:', !!this.softresData, 'keys:', this.softresData ? Object.keys(this.softresData) : 'null');
                if (this.softresData?.itemReserveMap) {
                    this.log('MinMaxer: itemReserveMap type:', typeof this.softresData.itemReserveMap, 'keys:', Object.keys(this.softresData.itemReserveMap).length);
                }
                sendResponse(this.softresData);
                break;
                
            case 'getAvailableItems':
                sendResponse({ availableItems: this.softresData?.availableItems || [] });
                break;
                
            case 'reanalyze':
                this.analyzePage();
                sendResponse({ success: true });
                break;
                
            case 'highlightBis':
                this.highlightBisItems();
                sendResponse({ success: true });
                break;
                
            default:
                sendResponse({ error: 'Unknown action' });
        }
    }
}

// Initialize analyzer
const softresAnalyzer = new SoftresAnalyzer();

// Add CSS for highlighting
const style = document.createElement('style');
style.textContent = `
    .minmaxer-highlight {
        transition: all 0.3s ease !important;
    }
    
    .minmaxer-highlight:hover {
        background-color: #ffcd3c66 !important;
        transform: scale(1.02) !important;
    }
`;
document.head.appendChild(style); 