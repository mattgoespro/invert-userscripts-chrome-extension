# chrome-vertex-ide-userscripts-extension

A Chrome extension that provides an integrated browser IDE for bundling and injecting TypeScript userscripts with full IntelliSense, multiple themes, auto-formatting, and one-click transpilation.

## Features

### 🎨 Full-Featured IDE
- **Monaco Editor** integration with IntelliSense support
- TypeScript and SCSS editing capabilities
- Multiple themes (Dark, Light, High Contrast)
- Auto-formatting on save
- Real-time type checking
- Syntax highlighting

### 🔧 TypeScript Support
- One-click transpilation and bundling
- Built-in TypeScript compiler
- Type checking with detailed error reporting
- Source map support

### 🚀 Script Injection
- Auto-inject scripts based on URL patterns
- Support for glob patterns (e.g., `https://example.com/*`)
- Configurable injection timing (document_start, document_end, document_idle)
- Enable/disable scripts individually

### 📦 Global Module Management
- Add CDN libraries accessible across all scripts
- Share modules between different userscripts
- Easy version management

### ⚙️ Customizable Settings
- Adjustable editor theme, font size, and tab size
- Auto-save functionality
- Toggle type checking
- Auto-format on save

## Installation

### From Source

1. Clone this repository:
```bash
git clone https://github.com/mattgoespro/chrome-vertex-ide-userscripts-extension.git
cd chrome-vertex-ide-userscripts-extension
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## Development

### Build Commands

```bash
# Build for production
npm run build

# Build and watch for changes (development)
npm run dev

# Generate icons
npm run icons

# Lint code
npm run lint

# Format code
npm run format
```

### Project Structure

```
chrome-vertex-ide-userscripts-extension/
├── src/
│   ├── background/          # Service worker for script injection
│   ├── popup/              # Extension popup UI
│   ├── options/            # Options page with IDE
│   ├── content/            # Content scripts
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions (storage, compiler)
├── public/
│   ├── manifest.json       # Extension manifest
│   └── icons/              # Extension icons
├── dist/                   # Build output (generated)
└── webpack.config.js       # Webpack configuration
```

## Usage

### Creating a Userscript

1. Click the extension icon and select "Options" or right-click the icon and choose "Options"
2. In the Scripts tab, click the ➕ button to create a new script
3. Edit the script name and description
4. Write your TypeScript code in the Monaco editor
5. Add URL patterns where the script should run (e.g., `https://github.com/*`)
6. Click "Compile & Bundle" to transpile your TypeScript to JavaScript
7. Enable the script using the checkbox
8. The script will automatically inject on matching pages!

### Example Userscript

```typescript
// main.ts
console.log('Hello from Vertex IDE!');

// Add a custom button to the page
const button = document.createElement('button');
button.textContent = 'Click me!';
button.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999;';
button.onclick = () => alert('Button clicked from userscript!');
document.body.appendChild(button);
```

### Adding Global Modules

1. Go to the "Global Modules" tab
2. Click "+ Add Module"
3. Enter the module name (e.g., "jQuery")
4. Enter the CDN URL (e.g., `https://code.jquery.com/jquery-3.6.0.min.js`)
5. Enable the module

Global modules will be loaded before your userscripts, making them available in all scripts.

### Settings

Customize your IDE experience in the Settings tab:
- **Editor Theme**: Choose between Dark, Light, or High Contrast
- **Font Size**: Adjust the editor font size (8-32px)
- **Tab Size**: Set indentation width (2-8 spaces)
- **Auto-format on save**: Automatically format code when saving
- **Auto-save**: Save changes automatically
- **Enable type checking**: Show TypeScript errors in real-time

## Architecture

### Background Service Worker
The background worker (`background.ts`) listens for page navigation and automatically injected enabled scripts that match the current URL pattern.

### Storage
Scripts, settings, and modules are stored using Chrome's `chrome.storage.local` API, providing persistent storage across browser sessions.

### TypeScript Compilation
The built-in TypeScript compiler (`utils/compiler.ts`) transpiles TypeScript code to JavaScript in the browser, supporting modern ES2020+ features.

### Script Injection
Scripts are injected into the `MAIN` world context, giving them full access to the page's JavaScript environment and DOM.

## Permissions

This extension requires the following permissions:
- **storage**: To save scripts, settings, and configurations
- **activeTab**: To inject scripts into the current tab
- **scripting**: To execute userscripts
- **webNavigation**: To detect page navigation for auto-injection
- **host_permissions**: Access to all URLs for script injection

## Technologies

- **TypeScript**: Type-safe code
- **React**: UI framework
- **Monaco Editor**: VS Code's editor engine
- **Webpack**: Module bundler
- **SCSS**: Styling
- **Chrome Extension Manifest V3**: Latest extension API

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Author

Matt Hamilton

## Acknowledgments

- Monaco Editor by Microsoft
- React by Facebook
- TypeScript by Microsoft

