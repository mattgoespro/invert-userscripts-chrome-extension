# Quick Installation Guide

## For Users

### Installation Steps

1. **Download the Extension**
   - Download the latest release from the GitHub releases page, or
   - Clone this repository and build from source (see below)

2. **Build from Source** (if you cloned the repo)
   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" using the toggle in the top-right corner
   - Click "Load unpacked" button
   - Browse to and select the `dist` folder from this project
   - The extension icon should appear in your Chrome toolbar

4. **Verify Installation**
   - Click the extension icon (blue square with `</>`)
   - You should see the popup showing "No scripts yet"
   - Click "⚙️ Options" to open the IDE

5. **Create Your First Script**
   - In the Options page, click the ➕ button
   - Edit the script name and add some code
   - Add a URL pattern (e.g., `https://example.com/*`)
   - Click "🔧 Compile & Bundle"
   - Enable the script with the checkbox
   - Visit a matching page to see your script in action!

## Troubleshooting Installation

### Extension Won't Load
- **Solution**: Make sure you're selecting the `dist` folder, not the root project folder
- Check that all files exist in the `dist` folder
- Ensure the manifest.json is valid

### Build Errors
- **Solution**: 
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  npm run build
  ```

### Icons Missing
- **Solution**: Run `npm run icons` to regenerate them

### Extension Loads but Doesn't Work
- Check the Chrome DevTools console for errors
- Make sure you've built the project with `npm run build`
- Try reloading the extension from `chrome://extensions/`

## Updating the Extension

When there's a new version:

1. Pull the latest changes (if using git):
   ```bash
   git pull origin main
   ```

2. Rebuild:
   ```bash
   npm install
   npm run build
   ```

3. Reload the extension:
   - Go to `chrome://extensions/`
   - Find "Vertex IDE Userscripts"
   - Click the reload icon (circular arrow)

## Uninstalling

1. Go to `chrome://extensions/`
2. Find "Vertex IDE Userscripts"
3. Click "Remove"
4. Confirm removal

All your scripts and settings will be deleted from Chrome storage.

## Getting Help

- Read the [User Guide](GUIDE.md)
- Check the [README](README.md)
- Look at [example scripts](examples/)
- Open an issue on GitHub if you need help

Enjoy scripting! 🚀
