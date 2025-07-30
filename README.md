# ⚔️ MinMaxer - Soft Reserve Optimizer

A Chrome extension designed to optimize your soft reserves on softres.it by showing competition levels for your Best in Slot (BiS) items.

## Features

- **BiS Item Management**: Configure and save your Best in Slot items for different raids
- **Competition Analysis**: See how many people have soft reserved each of your BiS items
- **Smart Recommendations**: Get optimization suggestions based on competition levels
- **Visual Highlighting**: BiS items are highlighted on softres.it pages
- **Raid Detection**: Automatically detects the current raid and shows relevant BiS items
- **Data Export/Import**: Save and share your BiS configurations

## Supported Raids

- Molten Core (MC)
- Blackwing Lair (BWL)
- Ruins of Ahn'Qiraj (AQ20)
- Temple of Ahn'Qiraj (AQ40)
- Naxxramas (NAXX)

## Installation

### From Source (Developer Mode)

1. **Download or clone this repository**
   ```bash
   git clone <repository-url>
   cd minmaxer
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `minmaxer` folder

4. **Verify installation**
   - You should see the MinMaxer extension in your extensions list
   - The extension icon will appear in your Chrome toolbar

## Usage

### Setting up BiS Items

1. **Open the extension popup** by clicking the MinMaxer icon in your Chrome toolbar
2. **Navigate to the "BiS List" tab**
3. **Select a raid** from the dropdown menu
4. **Add your BiS items** by typing item names and clicking "Add Item"
5. **Remove items** using the × button next to each item

### Using on softres.it

1. **Visit any softres.it raid page**
2. **Open the extension popup** to see the dashboard
3. **View competition levels** for your BiS items:
   - 🟢 **Low** (0-2 reserves): High chance of getting the item
   - 🟡 **Medium** (3-5 reserves): Moderate competition
   - 🔴 **High** (6+ reserves): Heavy competition

4. **Get recommendations** on which items to soft reserve based on competition
5. **See BiS items highlighted** on the page (if enabled in settings)

### Dashboard Features

- **Current Raid Info**: Shows detected raid name and player count
- **BiS Competition**: Lists your BiS items with current competition levels
- **Recommendations**: Smart suggestions for optimal soft reserve choices

### Settings

Access settings through the "Settings" tab in the extension popup:

- **Auto-analyze**: Automatically analyze softres pages when you visit them
- **Highlight BiS**: Highlight your BiS items on softres pages
- **Show recommendations**: Display optimization recommendations
- **Export/Import**: Backup and restore your BiS configurations

## Competition Levels

The extension categorizes competition into three levels:

- **🟢 Low Competition (0-2 reserves)**: Great chance of getting the item
- **🟡 Medium Competition (3-5 reserves)**: Moderate chance, consider backup options
- **🔴 High Competition (6+ reserves)**: Low chance, have alternatives ready

## Tips for Optimal Soft Reserves

1. **Prioritize low competition items** for your primary soft reserves
2. **Have backup options** for high competition items
3. **Check recommendations** before making your soft reserves
4. **Update your BiS list** as your gear progresses
5. **Export your BiS data** to back up your configurations

## Troubleshooting

### Extension not working on softres.it
- Make sure you've granted permissions to access softres.it
- Try refreshing the page and reopening the extension
- Check if the extension is enabled in chrome://extensions/

### BiS items not highlighting
- Ensure "Highlight BiS" is enabled in settings
- The highlighting works best when item names match exactly
- Try refreshing the page after adding new BiS items

### Data not saving
- Make sure Chrome sync is enabled for extension data persistence
- Try exporting your data as a backup
- Check Chrome storage permissions

### Competition counts seem wrong
- The extension uses heuristic analysis of page content
- Some items may have similar names causing false matches
- Competition counts are estimates and may not be 100% accurate

## Privacy

MinMaxer:
- Only accesses softres.it pages
- Stores BiS data locally in your Chrome storage
- Does not send any data to external servers
- Does not track your browsing activity

## Development

### Project Structure
```
minmaxer/
├── manifest.json       # Extension manifest
├── popup.html         # Extension popup interface
├── popup.css          # Popup styling
├── popup.js           # Popup functionality
├── content.js         # Content script for softres.it
├── styles.css         # Content script styles
├── background.js      # Background service worker
├── icons/            # Extension icons
└── README.md         # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on softres.it
5. Submit a pull request

## License

This project is open source. Feel free to use, modify, and distribute.

## Support

For issues, questions, or feature requests, please create an issue in the repository.

---

**Happy raiding and may RNG be with you!** ⚔️🎲 